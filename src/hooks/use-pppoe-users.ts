import { useQuery } from "@tanstack/react-query"
import { fetchPPPoEUsers, MikrotikCredentials, MikrotikPPPoEUser } from "@/lib/mikrotik"

export const usePPPoEUsers = (credentials: MikrotikCredentials | null) => {
  return useQuery<MikrotikPPPoEUser[]>({
    queryKey: ["pppoe-users", credentials?.address, credentials?.username],
    queryFn: () => {
      if (!credentials) {
        throw new Error("Missing credentials")
      }
      return fetchPPPoEUsers(credentials)
    },
    enabled: Boolean(credentials),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30,
  })
}
