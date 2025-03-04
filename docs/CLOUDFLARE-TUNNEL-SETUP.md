# Setting Up Cloudflare Tunnel for MikroTik Manager

This guide will walk you through setting up a Cloudflare Tunnel to securely access your MikroTik router from anywhere, even when your MikroTik Manager app is deployed on Vercel or another cloud platform.

## Prerequisites

1. A Cloudflare account with a registered domain
2. A device on your local network that can run the `cloudflared` daemon (e.g., a Raspberry Pi, NAS, or always-on computer)
3. Access to your MikroTik router's admin interface

## Step 1: Install Cloudflared

### On Linux (Ubuntu/Debian)

```bash
# Add Cloudflare GPG key
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo apt-key add -

# Add Cloudflare repository
echo "deb http://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Update and install
sudo apt-get update
sudo apt-get install cloudflared
```

### On Windows

Download the installer from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

### On macOS

```bash
brew install cloudflare/cloudflare/cloudflared
```

## Step 2: Authenticate Cloudflared

```bash
cloudflared tunnel login
```

This will open a browser window where you'll need to log in to your Cloudflare account and authorize the tunnel. After authorization, a certificate file will be saved to your local machine.

## Step 3: Create a Tunnel

```bash
# Create a named tunnel
cloudflared tunnel create mikrotik-tunnel

# This will generate a tunnel ID and credentials file
```

## Step 4: Configure the Tunnel

Create a configuration file at `~/.cloudflared/config.yml` (Linux/macOS) or `%USERPROFILE%\.cloudflared\config.yml` (Windows):

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /path/to/credentials/file.json

ingress:
  - hostname: mikrotik.yourdomain.com
    service: http://192.168.88.1
    originRequest:
      originServerName: mikrotik.yourdomain.com
    responseHeader:
      - name: Access-Control-Allow-Origin
        value: https://your-vercel-app.vercel.app
      - name: Access-Control-Allow-Methods
        value: GET, POST, PUT, DELETE, PATCH, OPTIONS
      - name: Access-Control-Allow-Headers
        value: Content-Type, Authorization
      - name: Access-Control-Allow-Credentials
        value: true
  - service: http_status:404
```

Replace:
- `<YOUR-TUNNEL-ID>` with the ID generated in Step 3
- `/path/to/credentials/file.json` with the actual path to your credentials file
- `mikrotik.yourdomain.com` with your desired subdomain
- `192.168.88.1` with your MikroTik router's local IP address
- `https://your-vercel-app.vercel.app` with your actual Vercel app URL (e.g., `https://rg-networks.vercel.app`)

## Step 5: Create DNS Record

```bash
cloudflared tunnel route dns mikrotik-tunnel mikrotik.yourdomain.com
```

This will create a CNAME record in your Cloudflare DNS settings.

## Step 6: Start the Tunnel

```bash
cloudflared tunnel run mikrotik-tunnel
```

To run it as a service:

### On Linux (systemd)

```bash
sudo cloudflared service install
```

### On Windows

```bash
cloudflared.exe service install
```

## Step 7: Configure MikroTik Manager

1. In your Vercel deployment, set the environment variable:
   ```
   NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL=true
   ```

2. Update the URL in `lib/mikrotik.ts` to match your Cloudflare Tunnel domain:
   ```typescript
   if (process.env.NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL === 'true') {
     // Use the Cloudflare Tunnel URL
     return `https://mikrotik.yourdomain.com/rest/${endpoint}`;
   }
   ```

3. With this configuration, the application will:
   - Hide the router IP address field in the connection form
   - Use only username and password for authentication
   - Connect directly through your Cloudflare Tunnel

## Troubleshooting

### Tunnel Not Connecting

Check the logs with:
```bash
cloudflared tunnel info mikrotik-tunnel
```

### CORS Issues in Development Mode

If you're running the application in development mode (`localhost:3000`) and getting network errors like:

```
AxiosError: Network Error
```

This is likely due to CORS (Cross-Origin Resource Sharing) restrictions. The browser is preventing your local application from making direct requests to your Cloudflare Tunnel domain.

The application should automatically use the proxy in development mode to avoid CORS issues. If you're still experiencing problems:

1. Make sure your `.env.local` file has the correct configuration:
   ```
   NEXT_PUBLIC_USE_CLOUDFLARE_TUNNEL=true
   ```

2. Check the browser console for more detailed error messages

3. Verify that the proxy route is working by visiting:
   ```
   http://localhost:3000/api/mikrotik-proxy?url=https://your-tunnel-domain.com/rest/system/resource
   ```
   
   You should see a 401 Unauthorized error (which is expected without proper credentials)

4. If you're still having issues, try clearing your browser cache or using an incognito/private window

### Certificate Issues

If you see certificate errors, ensure your MikroTik router is using HTTPS or configure Cloudflare to use HTTP for the origin:

```yaml
ingress:
  - hostname: mikrotik.yourdomain.com
    service: http://192.168.88.1
    originRequest:
      noTLSVerify: true
```

### Security Considerations

- Enable Cloudflare Zero Trust for additional security
- Consider setting up Access policies to restrict who can access your MikroTik router
- Use strong passwords for your MikroTik router admin account

### CORS Issues in Production

If you're experiencing CORS errors in your production Vercel deployment with messages like:

```
Access to XMLHttpRequest at 'https://your-tunnel.yourdomain.com/rest/system/resource' from origin 'https://your-app.vercel.app' has been blocked by CORS policy
```

You have two options:

1. **Configure CORS headers in your Cloudflare Tunnel** (recommended for direct browser-to-tunnel communication):
   - Update your Cloudflare Tunnel configuration as shown in Step 4 above
   - Make sure to set the correct `Access-Control-Allow-Origin` value for your Vercel domain
   - Restart your Cloudflare Tunnel after making these changes

2. **Use the API proxy approach** (already implemented in the code):
   - The application is configured to route all requests through the Next.js API proxy
   - This avoids CORS issues by having the server make the requests instead of the browser
   - No additional configuration is needed as this is the default behavior

The second approach (API proxy) is already implemented in the code and should work without any additional configuration. However, if you prefer direct communication between the browser and your Cloudflare Tunnel, you'll need to configure the CORS headers as described in option 1.

### Configuring CORS Headers with Token-Based Installation

If you installed Cloudflare Tunnel using the token method (`cloudflared service install [TOKEN]`), you can still configure CORS headers by modifying the configuration file:

1. Locate your configuration file:
   - Linux: `/etc/cloudflared/config.yml`
   - Windows: `%ProgramData%\cloudflared\config.yml`

2. Edit the file (you'll need administrator/root privileges):
   ```bash
   # On Linux
   sudo nano /etc/cloudflared/config.yml
   
   # On Windows (run PowerShell as Administrator)
   notepad C:\ProgramData\cloudflared\config.yml
   ```

3. Add the responseHeader section to your configuration:
   ```yaml
   # Your existing config will have tunnel and credentials-file entries
   # Add the ingress section with responseHeader:
   ingress:
     - hostname: rg-networks.rvcodes.com
       service: http://YOUR_MIKROTIK_IP
       responseHeader:
         - name: Access-Control-Allow-Origin
           value: https://rg-networks.vercel.app
         - name: Access-Control-Allow-Methods
           value: GET, POST, PUT, DELETE, PATCH, OPTIONS
         - name: Access-Control-Allow-Headers
           value: Content-Type, Authorization
         - name: Access-Control-Allow-Credentials
           value: true
     - service: http_status:404
   ```

4. Restart the Cloudflare Tunnel service:
   ```bash
   # On Linux
   sudo systemctl restart cloudflared
   
   # On Windows (run PowerShell as Administrator)
   Restart-Service cloudflared
   ```

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/) 