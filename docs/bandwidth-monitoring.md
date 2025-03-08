# Bandwidth Monitoring Implementation Guide

This document outlines a comprehensive plan to implement bandwidth monitoring for the MikroTik PPPoE Manager application using a syslog server.

## Table of Contents

1. [Syslog Server Setup](#1-syslog-server-setup)
2. [MikroTik Router Configuration](#2-mikrotik-router-configuration)
3. [Data Processing Service](#3-data-processing-service)
4. [Application Integration](#4-application-integration)
5. [Maintenance and Monitoring](#5-maintenance-and-monitoring)
6. [Deployment Options](#6-deployment-options)

## 1. Syslog Server Setup

### Server Installation
1. Set up a Linux server (Ubuntu/Debian recommended) to run the syslog service
2. Install rsyslog:
   ```bash
   sudo apt-get update
   sudo apt-get install rsyslog rsyslog-mysql mysql-server
   ```

### Configure rsyslog
1. Edit the rsyslog configuration file:
   ```bash
   sudo nano /etc/rsyslog.conf
   ```

2. Add UDP/TCP input modules:
   ```
   # Provides UDP syslog reception
   module(load="imudp")
   input(type="imudp" port="514")

   # Provides TCP syslog reception
   module(load="imtcp")
   input(type="imtcp" port="514")
   ```

3. Create a template for MikroTik bandwidth logs:
   ```
   # MikroTik bandwidth template
   template(name="MikrotikBandwidth" type="string" string="%TIMESTAMP:::date-rfc3339% %HOSTNAME% %syslogtag%%msg%\n")
   ```

### Database Setup
1. Create a database for syslog data:
   ```sql
   CREATE DATABASE syslog;
   USE syslog;
   
   CREATE TABLE bandwidth_logs (
     id INT AUTO_INCREMENT PRIMARY KEY,
     timestamp DATETIME,
     router VARCHAR(255),
     username VARCHAR(255),
     bytes_in BIGINT,
     bytes_out BIGINT,
     hour INT,
     processed BOOLEAN DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. Configure rsyslog to write to the database:
   ```
   # Load MySQL module
   module(load="ommysql")
   
   # MikroTik bandwidth logs to MySQL
   if $programname == 'bandwidth_monitor' then {
     action(type="ommysql" server="localhost" db="syslog" uid="syslog" pwd="password" 
            table="bandwidth_logs")
   }
   ```

3. Restart rsyslog:
   ```bash
   sudo systemctl restart rsyslog
   ```

## 2. MikroTik Router Configuration

### Enable IP Accounting
```
/ip accounting set enabled=yes account-local-traffic=yes threshold=0
/ip accounting web-access set accessible-via-web=yes
```

### Create Bandwidth Monitoring Script
Create a script on the MikroTik router:

```
# Create the script
/system script add name=bandwidth-monitor source={
# Bandwidth monitoring script
# Run this hourly to collect and send bandwidth usage data

# Get current hour
:local currentHour [:tostr [/system clock get time]]
:set currentHour [:pick $currentHour 0 2]

# Log script start
:log info "Bandwidth monitoring started for hour $currentHour"

# Iterate through active PPPoE connections
:foreach pppoeUser in=[/ppp active find where service="pppoe"] do={
    # Get username and IP
    :local username [/ppp active get $pppoeUser name]
    :local userIP [/ppp active get $pppoeUser address]
    
    # Get accounting data for this IP
    :local accountingData [/ip accounting snapshot find where src-address=$userIP]
    :if ([:len $accountingData] > 0) do={
        :local bytesIn [/ip accounting snapshot get $accountingData bytes-in]
        :local bytesOut [/ip accounting snapshot get $accountingData bytes-out]
        
        # Format message for syslog
        :local message "bandwidth_monitor: username=$username ip=$userIP bytes_in=$bytesIn bytes_out=$bytesOut hour=$currentHour"
        
        # Send to syslog
        :log info $message
    }
}

# Reset accounting data for the next hour
/ip accounting snapshot reset
/ip accounting snapshot take

:log info "Bandwidth monitoring completed for hour $currentHour"
}
```

### Alternative: Using Simple Queues (More Accurate)
If you're already using simple queues for your PPPoE users, this alternative script provides more accurate tracking:

```
# Create the script
/system script add name=bandwidth-monitor-queues source={
# Bandwidth monitoring using simple queues
:foreach queue in=[/queue simple find] do={
    :local queueName [/queue simple get $queue name]
    
    # Check if this is a PPPoE user queue (assuming naming convention)
    :if ([:find $queueName "pppoe-"] >= 0) do={
        :local username [:pick $queueName 6 [:len $queueName]]
        :local bytesIn [/queue simple get $queue bytes-in]
        :local bytesOut [/queue simple get $queue bytes-out]
        
        # Store previous values to calculate hourly usage
        :local prevBytesIn 0
        :local prevBytesOut 0
        
        # Try to get previous values from a file
        :if ([/file find name="bandwidth-$username.txt"] != "") do={
            :local content [/file get [/file find name="bandwidth-$username.txt"] contents]
            :local parts [:toarray $content]
            :set prevBytesIn [:tonum ($parts->0)]
            :set prevBytesOut [:tonum ($parts->1)]
        } else {
            # Create the file if it doesn't exist
            /file add name="bandwidth-$username.txt" contents="0,0"
        }
        
        # Calculate hourly usage
        :local hourlyBytesIn ($bytesIn - $prevBytesIn)
        :local hourlyBytesOut ($bytesOut - $prevBytesOut)
        
        # Handle counter reset (if values are negative)
        :if ($hourlyBytesIn < 0) do={ :set hourlyBytesIn $bytesIn }
        :if ($hourlyBytesOut < 0) do={ :set hourlyBytesOut $bytesOut }
        
        # Save current values for next run
        /file set [/file find name="bandwidth-$username.txt"] contents="$bytesIn,$bytesOut"
        
        # Format message for syslog
        :local currentHour [:pick [/system clock get time] 0 2]
        :local message "bandwidth_monitor: username=$username bytes_in=$hourlyBytesIn bytes_out=$hourlyBytesOut hour=$currentHour"
        
        # Send to syslog
        :log info $message
    }
}
}
```

### Schedule the Script
```
/system scheduler add name="Bandwidth Monitor" interval=1h on-event="/system script run bandwidth-monitor" start-time=00:00:00
```

### Configure Syslog
```
/system logging action add name=remote target=remote remote=YOUR_SYSLOG_SERVER_IP:514 bsd-syslog=yes
/system logging add action=remote topics=script,info
```

## 3. Data Processing Service

Create a Node.js script to process the syslog data and insert it into your application database:

```javascript
// process-bandwidth-logs.js
const mysql = require('mysql2/promise');

async function processSyslogData() {
  // Connect to the database
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'dbuser',
    password: 'dbpassword',
    database: 'mikrotik_manager'
  });
  
  try {
    // Create bandwidth_usage table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bandwidth_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        router_address VARCHAR(255) NOT NULL,
        timestamp DATETIME NOT NULL,
        hour INT NOT NULL,
        bytes_in BIGINT NOT NULL,
        bytes_out BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_timestamp (timestamp),
        INDEX idx_router (router_address)
      )
    `);
    
    // Query the syslog database for unprocessed logs
    const [rows] = await connection.execute(`
      SELECT * FROM syslog.bandwidth_logs 
      WHERE processed = 0 
      ORDER BY timestamp ASC
    `);
    
    console.log(`Processing ${rows.length} bandwidth log entries`);
    
    // Process each log entry
    for (const row of rows) {
      // Parse the log message to extract data
      // Example message: "bandwidth_monitor: username=user1 ip=10.0.0.1 bytes_in=1024 bytes_out=2048 hour=14"
      const message = row.message || '';
      
      // Extract data using regex
      const usernameMatch = message.match(/username=(\S+)/);
      const bytesInMatch = message.match(/bytes_in=(\d+)/);
      const bytesOutMatch = message.match(/bytes_out=(\d+)/);
      const hourMatch = message.match(/hour=(\d+)/);
      
      if (usernameMatch && bytesInMatch && bytesOutMatch && hourMatch) {
        const username = usernameMatch[1];
        const bytesIn = parseInt(bytesInMatch[1], 10);
        const bytesOut = parseInt(bytesOutMatch[1], 10);
        const hour = parseInt(hourMatch[1], 10);
        
        // Insert into our application database
        await connection.execute(`
          INSERT INTO bandwidth_usage 
          (username, router_address, timestamp, hour, bytes_in, bytes_out) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          username, 
          row.hostname, 
          row.timestamp, 
          hour, 
          bytesIn, 
          bytesOut
        ]);
        
        // Mark as processed
        await connection.execute(`
          UPDATE syslog.bandwidth_logs SET processed = 1 WHERE id = ?
        `, [row.id]);
      }
    }
    
    console.log('Bandwidth log processing completed');
  } catch (error) {
    console.error('Error processing bandwidth logs:', error);
  } finally {
    await connection.end();
  }
}

// Run the process
processSyslogData().catch(console.error);
```

Schedule this script to run regularly (e.g., every 15 minutes) using cron:

```bash
*/15 * * * * node /path/to/process-bandwidth-logs.js >> /var/log/bandwidth-processor.log 2>&1
```

## 4. Application Integration

### API Endpoint

Add a new API endpoint to your Next.js application:

```typescript
// app/api/bandwidth/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // Assuming you have a database utility

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const router = searchParams.get('router');
  const groupBy = searchParams.get('groupBy') || 'hour'; // hour, day, week, month
  
  if (!username || !router) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }
  
  const dateFilter = startDate && endDate 
    ? `AND timestamp BETWEEN ? AND ?` 
    : '';
  
  const params = [username, router];
  if (startDate && endDate) {
    params.push(startDate, endDate);
  }
  
  let groupByClause;
  let dateFormat;
  
  switch (groupBy) {
    case 'day':
      groupByClause = 'DATE(timestamp)';
      dateFormat = 'DATE(timestamp)';
      break;
    case 'week':
      groupByClause = 'YEARWEEK(timestamp, 1)';
      dateFormat = "CONCAT('Week ', WEEK(timestamp, 1), ', ', YEAR(timestamp))";
      break;
    case 'month':
      groupByClause = "DATE_FORMAT(timestamp, '%Y-%m')";
      dateFormat = "DATE_FORMAT(timestamp, '%M %Y')";
      break;
    case 'hour':
    default:
      groupByClause = 'DATE(timestamp), hour';
      dateFormat = "CONCAT(DATE(timestamp), ' ', hour, ':00')";
      break;
  }
  
  try {
    const data = await query(`
      SELECT 
        ${dateFormat} as period,
        SUM(bytes_in) as total_bytes_in, 
        SUM(bytes_out) as total_bytes_out
      FROM bandwidth_usage
      WHERE username = ? AND router_address = ? ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY timestamp ASC
    `, params);
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching bandwidth data:', error);
    return NextResponse.json({ error: 'Failed to fetch bandwidth data' }, { status: 500 });
  }
}
```

### Create a Bandwidth Chart Component

```tsx
// components/mikrotik/bandwidth-chart.tsx
'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { MikrotikCredentials } from '@/lib/mikrotik';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface BandwidthChartProps {
  credentials: MikrotikCredentials;
  username: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export function BandwidthChart({ 
  credentials, 
  username,
  startDate,
  endDate,
  groupBy = 'hour'
}: BandwidthChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        const params = new URLSearchParams({
          username,
          router: credentials.address,
          groupBy
        });
        
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const response = await fetch(`/api/bandwidth?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch bandwidth data');
        }
        
        const result = await response.json();
        setData(result.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [credentials, username, startDate, endDate, groupBy]);
  
  if (loading) return <div className="p-4 text-center">Loading bandwidth data...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  if (!data || data.length === 0) return <div className="p-4 text-center">No bandwidth data available</div>;
  
  // Format data for Chart.js
  const chartData = {
    labels: data.map(item => item.period),
    datasets: [
      {
        label: 'Download (MB)',
        data: data.map(item => item.total_bytes_in / (1024 * 1024)),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Upload (MB)',
        data: data.map(item => item.total_bytes_out / (1024 * 1024)),
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
      }
    ]
  };
  
  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Megabytes'
        }
      },
      x: {
        title: {
          display: true,
          text: groupBy.charAt(0).toUpperCase() + groupBy.slice(1)
        }
      }
    }
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Bandwidth Usage for {username}</h3>
      <Line data={chartData} options={chartOptions} />
      
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Summary</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded">
            <p className="text-sm text-gray-600">Total Download</p>
            <p className="text-xl font-bold">
              {(data.reduce((sum, item) => sum + item.total_bytes_in, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded">
            <p className="text-sm text-gray-600">Total Upload</p>
            <p className="text-xl font-bold">
              {(data.reduce((sum, item) => sum + item.total_bytes_out, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Integrate with PPPoE User Card

Update your PPPoE user card component to include a bandwidth button:

```tsx
// In components/mikrotik/pppoe-user-card.tsx
import { useState } from 'react';
import { BandwidthChart } from './bandwidth-chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

// Add state for bandwidth visibility
const [showBandwidth, setShowBandwidth] = useState(false);
const [bandwidthDateRange, setBandwidthDateRange] = useState({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
  endDate: new Date().toISOString().split('T')[0] // Today
});

// Add this to your card actions
<div className="flex space-x-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowBandwidth(!showBandwidth)}
  >
    {showBandwidth ? 'Hide Bandwidth' : 'View Bandwidth'}
  </Button>
  
  <Button
    variant="link"
    size="sm"
    asChild
  >
    <Link href={`/bandwidth?username=${user.name}`}>
      Detailed Analysis
    </Link>
  </Button>
</div>

// Add this section to display the bandwidth chart
{showBandwidth && (
  <div className="mt-4 border-t pt-4">
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-sm font-medium">Bandwidth Usage</h4>
      <div className="flex space-x-2">
        <Input
          type="date"
          value={bandwidthDateRange.startDate}
          onChange={(e) => setBandwidthDateRange({
            ...bandwidthDateRange,
            startDate: e.target.value
          })}
          className="w-32"
        />
        <Input
          type="date"
          value={bandwidthDateRange.endDate}
          onChange={(e) => setBandwidthDateRange({
            ...bandwidthDateRange,
            endDate: e.target.value
          })}
          className="w-32"
        />
      </div>
    </div>
    <BandwidthChart
      credentials={credentials}
      username={user.name}
      startDate={bandwidthDateRange.startDate}
      endDate={bandwidthDateRange.endDate}
    />
  </div>
)}
```

### Create a Dedicated Bandwidth Page

```tsx
// app/bandwidth/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BandwidthChart } from '@/components/mikrotik/bandwidth-chart';
import { 
  MikrotikCredentials, 
  loadCredentials,
  hasStoredCredentials
} from '@/lib/mikrotik';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BandwidthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  
  const [credentials, setCredentials] = useState<MikrotikCredentials | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    endDate: new Date().toISOString().split('T')[0] // Today
  });
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week' | 'month'>('hour');
  
  useEffect(() => {
    if (hasStoredCredentials()) {
      setCredentials(loadCredentials());
    } else {
      // Redirect to login if no credentials
      router.push('/');
    }
  }, [router]);
  
  if (!credentials) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>;
  }
  
  if (!username) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">No username specified. Please select a user from the main page.</p>
          <Button className="mt-4" onClick={() => router.push('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }
  
  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bandwidth Usage for {username}</h1>
        <Button onClick={() => router.back()}>Back</Button>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({
                ...dateRange,
                startDate: e.target.value
              })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">End Date</label>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({
                ...dateRange,
                endDate: e.target.value
              })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Group By</label>
            <Select 
              value={groupBy} 
              onValueChange={(value: 'hour' | 'day' | 'week' | 'month') => setGroupBy(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hour</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <BandwidthChart
          credentials={credentials}
          username={username}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          groupBy={groupBy}
        />
      </div>
    </main>
  );
}
```

## 5. Maintenance and Monitoring

### Data Retention Policy

Create a script to archive or delete old data:

```sql
-- Archive data older than 6 months
CREATE TABLE IF NOT EXISTS bandwidth_usage_archive LIKE bandwidth_usage;

INSERT INTO bandwidth_usage_archive
SELECT * FROM bandwidth_usage
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 6 MONTH);

DELETE FROM bandwidth_usage
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 6 MONTH);
```

Schedule this to run monthly:

```bash
0 0 1 * * mysql -u dbuser -p'dbpassword' mikrotik_manager < /path/to/archive_bandwidth.sql >> /var/log/bandwidth-archive.log 2>&1
```

### Monitoring

Set up basic monitoring for the syslog server:

```bash
# Check if rsyslog is running
if ! systemctl is-active --quiet rsyslog; then
  echo "CRITICAL: rsyslog is not running" | mail -s "Syslog Server Alert" admin@example.com
  systemctl restart rsyslog
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "WARNING: Disk usage is at ${DISK_USAGE}%" | mail -s "Syslog Server Alert" admin@example.com
fi

# Check database size
DB_SIZE=$(mysql -u dbuser -p'dbpassword' -e "SELECT table_schema, ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema='syslog' GROUP BY table_schema;" | awk 'NR==2 {print $2}')
if [ "$DB_SIZE" -gt 5000 ]; then  # 5GB
  echo "WARNING: Database size is ${DB_SIZE}MB" | mail -s "Syslog Server Alert" admin@example.com
fi
```

## 6. Deployment Options

### Docker Deployment

Create a Docker Compose file for easy deployment:

```yaml
# docker-compose.yml
version: '3'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: syslog
      MYSQL_USER: syslog
      MYSQL_PASSWORD: password
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "3306:3306"
    restart: always

  rsyslog:
    build:
      context: ./rsyslog
      dockerfile: Dockerfile
    ports:
      - "514:514/udp"
      - "514:514/tcp"
    depends_on:
      - mysql
    volumes:
      - ./logs:/var/log
    restart: always

  processor:
    build:
      context: ./processor
      dockerfile: Dockerfile
    depends_on:
      - mysql
      - rsyslog
    restart: always

volumes:
  mysql-data:
```

## Summary

This implementation plan provides a comprehensive solution for tracking bandwidth usage per hour per user in the MikroTik PPPoE Manager application. The solution uses:

1. A syslog server to collect bandwidth data from the MikroTik router
2. A database to store and process the data
3. API endpoints to retrieve the data
4. UI components to visualize the data

The solution is scalable, maintainable, and integrates well with the existing application. It provides valuable insights into user bandwidth usage patterns, which can help with troubleshooting, capacity planning, and billing. 