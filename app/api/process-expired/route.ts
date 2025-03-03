import { NextRequest, NextResponse } from 'next/server';
import { 
  MikrotikCredentials, 
  processExpiredUsers 
} from '@/lib/mikrotik';

export async function POST(request: NextRequest) {
  try {
    const { credentials } = await request.json();
    
    if (!credentials || !credentials.address || !credentials.username || !credentials.password) {
      return NextResponse.json(
        { error: 'Missing or invalid credentials' },
        { status: 400 }
      );
    }
    
    const processedCount = await processExpiredUsers(credentials as MikrotikCredentials);
    
    return NextResponse.json({
      success: true,
      processedCount,
      message: processedCount > 0 
        ? `Successfully processed ${processedCount} expired user(s)` 
        : 'No expired users found to process'
    });
  } catch (error: any) {
    console.error('Error processing expired users:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 