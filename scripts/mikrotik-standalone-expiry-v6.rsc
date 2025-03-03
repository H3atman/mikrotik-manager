# MikroTik Self-Contained Script for Processing Expired PPPoE Users
# This simplified version is compatible with RouterOS v6
# This script runs entirely on the router and doesn't require external API calls
# Updated to handle both expiry date and time

/system script
add name="process-expired-users-v6" source={
    # Log start of processing
    :log info "Starting to process expired PPPoE users...";
    :local processedCount 0;
    
    # Get current date and time
    :local currentDate [/system clock get date];
    :local currentTime [/system clock get time];
    
    # Parse current date
    :local monthNames {"jan"="01";"feb"="02";"mar"="03";"apr"="04";"may"="05";"jun"="06";"jul"="07";"aug"="08";"sep"="09";"oct"="10";"nov"="11";"dec"="12"};
    :local monthName [:pick $currentDate 0 3];
    :local month ($monthNames->$monthName);
    :local day [:pick $currentDate 4 6];
    :local year [:pick $currentDate 7 11];
    :local today "$year-$month-$day";
    
    # Parse current time (hours and minutes only)
    :local currentHour [:pick $currentTime 0 2];
    :local currentMinute [:pick $currentTime 3 5];
    :local nowTime "$currentHour:$currentMinute";
    
    :log info "Current date and time: $today $nowTime";
    
    # Get all PPP secrets
    /ppp secret {
        :foreach i in=[find] do={
            :local name [get $i name];
            :local profile [get $i profile];
            :local comment [get $i comment];
            :local isExpired false;
            
            # Extract expiry date - supports format: EXPIRY=YYYY-MM-DD
            :local expiryDate "";
            :local expiryTime "23:59"; # Default to end of day if not specified
            
            # Extract expiry date
            :local expiryPos [:find $comment "EXPIRY="];
            :if ($expiryPos >= 0) do={
                :local afterExpiry [:pick $comment ($expiryPos + 7) 999];
                :local spacePos [:find $afterExpiry " "];
                
                :if ($spacePos >= 0) do={
                    :set expiryDate [:pick $afterExpiry 0 $spacePos];
                } else={
                    :set expiryDate $afterExpiry;
                }
            }
            
            # Also check for bracket format [EXPIRY:YYYY-MM-DD]
            :local bracketExpiryPos [:find $comment "[EXPIRY:"];
            :if ($bracketExpiryPos >= 0 && [:len $expiryDate] = 0) do={
                :local afterBracketExpiry [:pick $comment ($bracketExpiryPos + 8) 999];
                :local bracketEndPos [:find $afterBracketExpiry "]"];
                
                :if ($bracketEndPos >= 0) do={
                    :set expiryDate [:pick $afterBracketExpiry 0 $bracketEndPos];
                }
            }
            
            # Extract expiry time - supports format: TIME=HH:MM
            :local timePos [:find $comment "TIME="];
            :if ($timePos >= 0) do={
                :local afterTime [:pick $comment ($timePos + 5) 999];
                :local spacePos [:find $afterTime " "];
                
                :if ($spacePos >= 0) do={
                    :set expiryTime [:pick $afterTime 0 $spacePos];
                } else={
                    :set expiryTime $afterTime;
                }
            }
            
            # Also check for bracket format [TIME:HH:MM]
            :local bracketTimePos [:find $comment "[TIME:"];
            :if ($bracketTimePos >= 0) do={
                :local afterBracketTime [:pick $comment ($bracketTimePos + 6) 999];
                :local bracketEndPos [:find $afterBracketTime "]"];
                
                :if ($bracketEndPos >= 0) do={
                    :set expiryTime [:pick $afterBracketTime 0 $bracketEndPos];
                }
            }
            
            # Extract post-expiry profile
            :local postProfile "";
            :local postPos [:find $comment "POST-EXPIRY="];
            :if ($postPos >= 0) do={
                :local afterPost [:pick $comment ($postPos + 12) 999];
                :local spacePos [:find $afterPost " "];
                
                :if ($spacePos >= 0) do={
                    :set postProfile [:pick $afterPost 0 $spacePos];
                } else={
                    :set postProfile $afterPost;
                }
            }
            
            # Also check for bracket format [POST-EXPIRY:profile]
            :local bracketPostPos [:find $comment "[POST-EXPIRY:"];
            :if ($bracketPostPos >= 0 && [:len $postProfile] = 0) do={
                :local afterBracketPost [:pick $comment ($bracketPostPos + 13) 999];
                :local bracketEndPos [:find $afterBracketPost "]"];
                
                :if ($bracketEndPos >= 0) do={
                    :set postProfile [:pick $afterBracketPost 0 $bracketEndPos];
                }
            }
            
            # Check if expiry data is present and user has a post-expiry profile
            :if ([:len $expiryDate] > 0 && [:len $postProfile] > 0) do={
                # Extract time components
                :local expiryHour [:pick $expiryTime 0 2];
                :local expiryMinute [:pick $expiryTime 3 5];
                
                # Check if expired
                :if ($expiryDate < $today) do={
                    # Expired based on date alone
                    :set isExpired true;
                } else={
                    :if ($expiryDate = $today) do={
                        # Same date, check time
                        :if ("$expiryHour:$expiryMinute" < "$currentHour:$currentMinute") do={
                            # Expired based on time
                            :set isExpired true;
                        }
                    }
                }
                
                # Process expired user if needed
                :if ($isExpired && $profile != $postProfile) do={
                    :log info "User $name is expired (Expiry: $expiryDate $expiryTime). Changing profile from $profile to $postProfile";
                    
                    # Update user profile
                    set $i profile=$postProfile;
                    
                    # Disconnect active session
                    /ppp active {
                        :foreach j in=[find where name=$name] do={
                            remove $j;
                            :log info "Disconnected active session for user: $name";
                        }
                    }
                    
                    :set processedCount ($processedCount + 1);
                }
            }
        }
    }
    
    # Log completion
    :if ($processedCount > 0) do={
        :log info "Successfully processed $processedCount expired PPPoE user(s)";
    } else={
        :log info "No expired users found to process";
    }
} comment="Simplified script to process expired PPPoE users with time support (RouterOS v6 compatible)"

# Add a scheduler to run the script daily at midnight
/system scheduler
add name="process-expired-users-v6-daily" interval=1d start-time=00:00:00 on-event="/system script run process-expired-users-v6" comment="Daily processing of expired PPPoE users"

# To use this script:
# 1. Upload this file to your MikroTik router
# 2. Run the following command in your MikroTik terminal:
#    /import mikrotik-standalone-expiry-v6.rsc
#
# To manually run the script for testing:
#    /system script run process-expired-users-v6
#
# To check the logs:
#    /log print
#
# To remove everything if needed:
#    /system script remove [find name="process-expired-users-v6"]
#    /system scheduler remove [find name="process-expired-users-v6-daily"] 