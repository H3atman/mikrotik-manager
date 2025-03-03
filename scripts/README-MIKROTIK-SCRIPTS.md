# MikroTik PPPoE Hybrid Management Approach

This document explains how to use the hybrid approach for managing PPPoE users with your application and MikroTik scheduler.

## The Hybrid Approach

The hybrid approach combines the best of both worlds:

1. **Your Web Application**: For user-friendly management of PPPoE users and their expiration dates/times
2. **Self-Contained MikroTik Script**: For reliable automated processing of expired users

## How It Works

### Your Application Handles:

- Creating new PPPoE users with expiration dates and times
- Updating expiration dates/times for existing users
- Setting post-expiry profiles for users
- Viewing and monitoring user status and expiration dates
- Manual processing of expired users when needed (via the UI button)

### The MikroTik Script Handles:

- Automatic daily checking for expired users
- Applying profile changes to users who have expired
- Disconnecting active sessions to enforce profile changes
- Logging all actions in the router's log

## Benefits of This Approach

- **User-Friendly Interface**: Your application provides a nice UI for managing users
- **Reliable Automation**: The self-contained script ensures expired users are processed even if your application server is down
- **No Connectivity Issues**: You avoid any timeout problems with network connectivity
- **Simplicity**: No need to expose your application server to the router
- **Performance**: Direct processing on the router is faster than API calls

## Files Provided

1. **`mikrotik-standalone-expiry.rsc`**: Main script for RouterOS v7+ that processes expired users directly on the router
2. **`mikrotik-standalone-expiry-v6.rsc`**: Simplified version compatible with RouterOS v6

## Setup Instructions

1. **Choose the appropriate script** based on your RouterOS version:
   - For RouterOS v7+: Use `mikrotik-standalone-expiry.rsc`
   - For RouterOS v6: Use `mikrotik-standalone-expiry-v6.rsc`

2. **Upload the script file** to your MikroTik router using one of these methods:
   - Upload via WinBox: Files → Upload
   - Upload via WebFig: Files → Upload
   - Copy and paste the script content directly into a Terminal

3. **Import the script** with one of these commands:
   ```
   /import mikrotik-standalone-expiry.rsc
   ```
   or
   ```
   /import mikrotik-standalone-expiry-v6.rsc
   ```

4. **Test the script manually**:
   ```
   /system script run process-expired-users-standalone
   ```
   or
   ```
   /system script run process-expired-users-v6
   ```

5. **Check the logs** to see if it correctly identifies and processes expired users:
   ```
   /log print
   ```

## Comment Format Compatibility

The MikroTik script recognizes multiple formats for expiry information in user comments:

| Information | Bracket Format | Plain Format |
|-------------|----------------|--------------|
| Expiry Date | `[EXPIRY:2023-12-31]` | `EXPIRY=2023-12-31` |
| Expiry Time | `[TIME:14:30]` | `TIME=14:30` |
| Post-Expiry Profile | `[POST-EXPIRY:basic]` | `POST-EXPIRY=basic` |

### Time Support

The scripts now support time-based expiry:

- If a time is specified, the user will expire at that exact time on the expiry date
- If no time is specified, the default is `23:59` (end of day)
- Time format is 24-hour (HH:MM)

For example, a user with:
- `[EXPIRY:2023-12-31]` `[TIME:14:30]` `[POST-EXPIRY:basic]`

Will expire at 2:30 PM on December 31, 2023, and their profile will be changed to "basic".

## How to Test

To test if the script is working correctly:

1. **Use your application** to set an expiry date and time for a test user (set to a time that's about to pass)
2. **Run the script manually**:
   ```
   /system script run process-expired-users-standalone
   ```
3. **Check the logs**:
   ```
   /log print
   ```
4. **Verify that**:
   - The script identified the expired user
   - The user's profile was changed to the post-expiry profile
   - Any active sessions were disconnected

## Scheduler Details

The script automatically sets up a scheduler to run daily at midnight. You can view scheduler details with:

```
/system scheduler print
```

To change the schedule, modify the scheduler:

```
/system scheduler edit [find name="process-expired-users-daily"]
```

## Troubleshooting

If the script isn't working as expected:

1. **Check the logs** for error messages:
   ```
   /log print
   ```

2. **Verify the comment format** for a test user:
   ```
   /ppp secret print detail where name="test_user"
   ```

3. **Manually run the script** with verbose logging:
   ```
   /system script run process-expired-users-standalone
   ```

4. **Check that the router's clock** is set to the correct date and time:
   ```
   /system clock print
   ```

## Uninstalling

If you need to remove the script:

```
/system script remove [find name="process-expired-users-standalone"]
/system scheduler remove [find name="process-expired-users-daily"]
```

Or for v6 version:

```
/system script remove [find name="process-expired-users-v6"]
/system scheduler remove [find name="process-expired-users-v6-daily"]
``` 