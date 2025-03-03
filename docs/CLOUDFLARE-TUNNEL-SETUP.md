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
  - service: http_status:404
```

Replace:
- `<YOUR-TUNNEL-ID>` with the ID generated in Step 3
- `/path/to/credentials/file.json` with the actual path to your credentials file
- `mikrotik.yourdomain.com` with your desired subdomain
- `192.168.88.1` with your MikroTik router's local IP address

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

## Troubleshooting

### Tunnel Not Connecting

Check the logs with:
```bash
cloudflared tunnel info mikrotik-tunnel
```

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

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/) 