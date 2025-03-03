# MikroTik Self-Contained Script for Processing Expired PPPoE Users
# This script runs entirely on the router and doesn't require external API calls
# Uses standardized ISO date format (YYYY-MM-DD)

# COMMENT FORMAT:
# YYYY-MM-DD,HH:MM,ProfileName
# Example: 2023-12-31,23:59,Speed_512k

/system script
add name="process-expired-users-standalone" source={
    # Log start of processing
    :log info "===== STARTING EXPIRED USERS PROCESSING =====";
    :local processedCount 0;
    :local totalUsers 0;
    :local errorCount 0;
    
    # Get all PPP secrets (users)
    :do {
        :local users [/ppp secret find];
        :set totalUsers [:len $users];
        :log info "Found $totalUsers PPP users to process";
        
        # Get current date and time - directly using ISO format from RouterOS v7
        :local currentDate [/system clock get date];
        :local currentTime [/system clock get time];
        :log info "Current system date: '$currentDate', Current system time: '$currentTime'";
        
        # Format current time as HH:MM for comparison
        :local currentHour [:pick $currentTime 0 2];
        :local currentMinute [:pick $currentTime 3 5];
        :local currentTimeFormatted "$currentHour:$currentMinute";
        
        # Current date is already in YYYY-MM-DD format in RouterOS v7
        :local currentDateStandardized $currentDate;
        :log info "Using system date in ISO format: $currentDateStandardized";
        
        # Process each user
        :foreach userId in=$users do={
            :local userName "UNKNOWN_USER";
            :local stage "initialization";
            
            :do {
                # Get user details first
                :set stage "fetching user details";
                :local user [/ppp secret get $userId];
                :set userName ($user->"name");
                :local userProfile ($user->"profile");
                :local userComment ($user->"comment");
                
                :log debug "Processing user: $userName (ID: $userId, Profile: $userProfile)";
                :log debug "User comment: $userComment";
                
                # Parse the comma-separated format (YYYY-MM-DD,HH:MM,ProfileName)
                :set stage "extracting expiry information";
                :local userExpiryDate "";
                :local userExpiryTime "";
                :local userPostExpiryProfile "";
                :local isValidFormat false;
                
                # Check if we have commas for the format
                :local firstComma [:find $userComment "," -1];
                :if ($firstComma > 0) do={
                    :local commentParts [:toarray ""];
                    :local partStart 0;
                    :local partEnd 0;
                    :local partIndex 0;
                    
                    # Parse comma-separated format
                    :do {
                        :set partEnd [:find $userComment "," $partStart];
                        :if ($partEnd > 0) do={
                            # Extract part between commas
                            :set ($commentParts->$partIndex) [:pick $userComment $partStart $partEnd];
                            :set partStart ($partEnd + 1);
                            :set partIndex ($partIndex + 1);
                        } else {
                            # Last part (after last comma)
                            :set ($commentParts->$partIndex) [:pick $userComment $partStart [:len $userComment]];
                            :set partIndex ($partIndex + 1);
                        }
                    } while=($partEnd > 0);
                    
                    # We expect 3 parts: YYYY-MM-DD,HH:MM,ProfileName
                    :if ($partIndex >= 3) do={
                        :local datePart ($commentParts->0);
                        :local timePart ($commentParts->1);
                        :local profilePart ($commentParts->2);
                        
                        # Validate date format (YYYY-MM-DD) - simple check for now
                        :if ([:len $datePart] = 10 && [:pick $datePart 4 5] = "-" && [:pick $datePart 7 8] = "-") do={
                            :set userExpiryDate $datePart;
                            :set userExpiryTime $timePart;
                            :set userPostExpiryProfile $profilePart;
                            :set isValidFormat true;
                            :log debug "Parsed format - Date: $userExpiryDate, Time: $userExpiryTime, Profile: $userPostExpiryProfile";
                        }
                    }
                }
                
                # Default time to 23:59 if not specified or invalid
                :if ([:len $userExpiryTime] = 0) do={
                    :set userExpiryTime "23:59";
                    :log debug "Using default expiry time: $userExpiryTime";
                }
                
                # Check if user has the required information for expiry processing
                :set stage "checking expiry conditions";
                :if ($isValidFormat && [:len $userExpiryDate] > 0 && [:len $userPostExpiryProfile] > 0) do={
                    # Validate date format (should be YYYY-MM-DD)
                    :local isValidDate true;
                    
                    :do {
                        # Check length first
                        :if ([:len $userExpiryDate] != 10) do={
                            :set isValidDate false;
                            :log warning "User $userName has invalid expiry date format (wrong length): $userExpiryDate";
                        } else={
                            # Check if it has the correct format with hyphens
                            :if ([:pick $userExpiryDate 4 5] != "-" || [:pick $userExpiryDate 7 8] != "-") do={
                                :set isValidDate false;
                                :log warning "User $userName has invalid expiry date format (missing hyphens): $userExpiryDate";
                            }
                        }
                    } on-error={
                        :set isValidDate false;
                        :log warning "Error validating date format for user $userName, expiry date: $userExpiryDate";
                    }

                    # Validate time format (should be HH:MM)
                    :local isValidTime true;
                    
                    :do {
                        # Check length first
                        :if ([:len $userExpiryTime] != 5) do={
                            :set isValidTime false;
                            :log warning "User $userName has invalid expiry time format (wrong length): $userExpiryTime";
                        } else={
                            # Check if it has the correct format with colon
                            :if ([:pick $userExpiryTime 2 3] != ":") do={
                                :set isValidTime false;
                                :log warning "User $userName has invalid expiry time format (missing colon): $userExpiryTime";
                            }
                        }
                    } on-error={
                        :set isValidTime false;
                        :log warning "Error validating time format for user $userName, expiry time: $userExpiryTime";
                    }
                    
                    # Only proceed if both date and time are valid
                    :if ($isValidDate && $isValidTime) do={
                        :log debug "User $userName has valid expiry information: Date=$userExpiryDate, Time=$userExpiryTime, Post-profile=$userPostExpiryProfile";
                        
                        # Variables to store comparison result
                        :local isExpired false;
                        :local dateCompareReason "not expired (unable to determine)";
                        
                        # More robust date and time comparison
                        :do {
                            # Log the values we're comparing for debugging
                            :log debug "Comparing dates: User expiry=$userExpiryDate, Current=$currentDateStandardized";
                            :log debug "Comparing times: User expiry=$userExpiryTime, Current=$currentTimeFormatted";
                            
                            # Extract parts for proper numeric comparison
                            :local expYear [:tonum [:pick $userExpiryDate 0 4]];
                            :local expMonth [:tonum [:pick $userExpiryDate 5 7]];
                            :local expDay [:tonum [:pick $userExpiryDate 8 10]];
                            
                            :local curYear [:tonum [:pick $currentDateStandardized 0 4]];
                            :local curMonth [:tonum [:pick $currentDateStandardized 5 7]];
                            :local curDay [:tonum [:pick $currentDateStandardized 8 10]];
                            
                            :local expHour [:tonum [:pick $userExpiryTime 0 2]];
                            :local expMinute [:tonum [:pick $userExpiryTime 3 5]];
                            
                            :local curHour [:tonum [:pick $currentTimeFormatted 0 2]];
                            :local curMinute [:tonum [:pick $currentTimeFormatted 3 5]];
                            
                            # Compare year first
                            :if ($expYear < $curYear) do={
                                # Expired (past year)
                                :set isExpired true;
                                :set dateCompareReason "expired by year ($expYear < $curYear)";
                            } else {:if ($expYear = $curYear) do={
                                # Same year, compare month
                                :if ($expMonth < $curMonth) do={
                                    # Expired (past month)
                                    :set isExpired true;
                                    :set dateCompareReason "expired by month ($expMonth < $curMonth)";
                                } else {:if ($expMonth = $curMonth) do={
                                    # Same month, compare day
                                    :if ($expDay < $curDay) do={
                                        # Expired (past day)
                                        :set isExpired true;
                                        :set dateCompareReason "expired by day ($expDay < $curDay)";
                                    } else {:if ($expDay = $curDay) do={
                                        # Same day, compare time
                                        :if ($expHour < $curHour) do={
                                            # Expired (past hour)
                                            :set isExpired true;
                                            :set dateCompareReason "expired by hour ($expHour < $curHour)";
                                        } else {:if ($expHour = $curHour) do={
                                            # Same hour, compare minute
                                            :if ($expMinute < $curMinute) do={
                                                # Expired (past minute)
                                                :set isExpired true;
                                                :set dateCompareReason "expired by minute ($expMinute < $curMinute)";
                                            } else={
                                                :set dateCompareReason "not expired (future minute: $expMinute > $curMinute)";
                                            }
                                        } else={
                                            :set dateCompareReason "not expired (future hour: $expHour > $curHour)";
                                        }}
                                    } else={
                                        :set dateCompareReason "not expired (future day: $expDay > $curDay)";
                                    }}
                                } else={
                                    :set dateCompareReason "not expired (future month: $expMonth > $curMonth)";
                                }}
                            } else={
                                :set dateCompareReason "not expired (future year: $expYear > $curYear)";
                            }}
                        } on-error={
                            :log warning "Error in date/time comparison for user $userName. Check values: ExpDate=$userExpiryDate, CurDate=$currentDateStandardized, ExpTime=$userExpiryTime, CurTime=$currentTimeFormatted";
                            :set dateCompareReason "not expired (comparison failed)";
                        }
                        
                        :log info "User $userName expiry status: $dateCompareReason";
                        
                        # Process expired user
                        :if ($isExpired && $userProfile != $userPostExpiryProfile) do={
                            :set stage "updating expired user profile";
                            :log info "Changing profile for $userName from $userProfile to $userPostExpiryProfile";
                            
                            # Update user profile
                            :do {
                                :set stage "setting new profile";
                                /ppp secret set $userId profile=$userPostExpiryProfile;
                                :log info "Successfully updated profile for user $userName";
                            
                                # Disconnect active session to apply new profile
                                :set stage "disconnecting active session";
                                :local activeId [/ppp active find where name=$userName];
                                :if ([:len $activeId] > 0) do={
                                    /ppp active remove $activeId;
                                    :log info "Disconnected active session for user: $userName";
                                } else={
                                    :log debug "No active session found for user: $userName";
                                }
                                
                                :set processedCount ($processedCount + 1);
                            } on-error={
                                :set errorCount ($errorCount + 1);
                                :log error "Failed to update profile for user $userName: error in $stage operation";
                            }
                        } else={
                            :if ($isExpired) do={
                                :log info "User $userName is already on post-expiry profile $userPostExpiryProfile, no action needed";
                            } else={
                                :log debug "User $userName is not expired, no action needed (status: $dateCompareReason)";
                            }
                        }
                    } else={
                        :log warning "User $userName has required tags but date/time format is invalid: Date='$userExpiryDate', Time='$userExpiryTime'";
                    }
                } else={
                    :if (!$isValidFormat) do={
                        :log debug "Skipping user $userName: Comment format does not match YYYY-MM-DD,HH:MM,ProfileName";
                    }
                    :if ([:len $userExpiryDate] = 0) do={
                        :log debug "Skipping user $userName: Missing expiry date";
                    }
                    :if ([:len $userPostExpiryProfile] = 0) do={
                        :log debug "Skipping user $userName: Missing post-expiry profile";
                    }
                }
            } on-error={
                :set errorCount ($errorCount + 1);
                :log error "Error processing user $userName: failed at stage '$stage'";
            }
        }
    } on-error={
        :log error "Critical error in main script execution. Check script syntax and permissions.";
    }
    
    # Log completion
    :log info "===== COMPLETED: Processed $processedCount expired PPPoE user(s) out of $totalUsers total users ($errorCount errors) =====";
} comment="Self-contained script to process expired PPPoE users with simplified comma-separated format (YYYY-MM-DD,HH:MM,ProfileName)"

# Add a scheduler to run the script daily at midnight
/system scheduler
add name="process-expired-users-daily" interval=1d start-time=00:00:00 on-event="/system script run process-expired-users-standalone" comment="Daily processing of expired PPPoE users"

# COMMENT FORMAT FOR PPP SECRETS:
# ===================================
# Use the comma-separated format:
#
# YYYY-MM-DD,HH:MM,ProfileName
#
# Example 1: 2023-12-31,23:59,Speed_512k
# Example 2: 2024-06-30,23:59,Due_Date_128k
# 
# The script will change the user's profile to the specified profile when 
# the expiration date and time have passed.

# To use this script:
# 1. Upload this file to your MikroTik router
# 2. Run the following command in your MikroTik terminal:
#    /import mikrotik-simplified-expiry.rsc
#
# To manually run the script for testing:
#    /system script run process-expired-users-standalone
#
# To check the logs:
#    /log print where message~"expired"
#
# To enable debug logging (for more detailed information):
#    /system logging add topics=debug action=memory
#
# To view debug logs:
#    /log print where topics~debug
#
# To remove everything if needed:
#    /system script remove [find name="process-expired-users-standalone"]
#    /system scheduler remove [find name="process-expired-users-daily"]