"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSyncExternalStore } from "react"

// Subscribe function that does nothing (we only care about the initial mount)
const subscribe = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  
  // Use useSyncExternalStore to safely detect client-side mounting
  // This avoids the anti-pattern of calling setState in useEffect
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,  // Client: always mounted
    () => false  // Server: never mounted
  )

  const isDark = (resolvedTheme || theme) === "dark"

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark")
  }

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-9 w-9" disabled>
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
