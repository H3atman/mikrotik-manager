"use client"

import { addMonths, format, startOfMonth } from "date-fns"
import { IconCalendar } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerWithNextMonthProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePickerWithNextMonth({
  value,
  onChange,
  placeholder = "Pick a date",
}: DatePickerWithNextMonthProps) {
  const firstDayOfNextMonth = startOfMonth(addMonths(new Date(), 1))

  const handleDateChange = (newDate: Date | undefined) => {
    onChange?.(newDate)
  }

  const setNextMonth = () => {
    handleDateChange(firstDayOfNextMonth)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full sm:w-[280px] h-10 sm:h-9 justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <IconCalendar className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col space-y-2 p-3" align="start">
        <div className="rounded-md border">
          <Calendar mode="single" selected={value} onSelect={handleDateChange} initialFocus />
        </div>
        <Button
          variant="outline"
          className="w-full h-10 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          onClick={setNextMonth}
        >
          Set to first day of next month
        </Button>
      </PopoverContent>
    </Popover>
  )
}
