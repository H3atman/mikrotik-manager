"use client"

import * as React from "react"
import { addMonths, format, startOfMonth } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithNextMonthProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
}

export function DatePickerWithNextMonth({ value, onChange }: DatePickerWithNextMonthProps) {
  const [date, setDate] = React.useState<Date | undefined>(value)

  const firstDayOfNextMonth = startOfMonth(addMonths(new Date(), 1))

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate)
    onChange?.(newDate)
  }

  React.useEffect(() => {
    if (value !== date) {
      setDate(value)
    }
  }, [value, date])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
        <div className="rounded-md border">
          <Calendar mode="single" selected={date} onSelect={handleDateChange} />
        </div>
        <Button
          variant="outline"
          className="w-full text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          onClick={() => handleDateChange(firstDayOfNextMonth)}
        >
          Set to first day of next month
        </Button>
      </PopoverContent>
    </Popover>
  )
} 