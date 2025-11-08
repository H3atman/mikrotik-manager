# Changelog - November 8, 2025

## Mobile-First UI/UX Improvements & New Features

### ✨ New Features

#### 1. "Paid" Button for Quick Expiry Updates
- Added green "Paid" button to user cards
- Automatically sets expiry date to first day of next month
- Preserves existing time and profile settings from comment
- Uses format: `YYYY-MM-DD,HH:MM,ProfileName`
- Default format when no existing comment: `YYYY-MM-DD,23:59,Due_Date_512Kbps`
- Fixed timezone issues for accurate date calculation

### 🎨 UI/UX Improvements

#### Mobile-First Design
- **Sheet Component**: Replaced Drawer with Sheet for better mobile experience
  - Bottom sheets on mobile (90vh height)
  - Dialog-style on desktop
  - Smooth slide-up animations

#### Enhanced Touch Targets
- **Buttons**: Increased to h-10 (40px) on mobile, h-9 on desktop
- **Calendar dates**: 40px × 40px on mobile, 36px × 36px on desktop
- **Navigation buttons**: 36px × 36px on mobile
- All touch targets meet 44px accessibility minimum

#### Calendar Component Fixes
- **Larger touch targets** for better mobile usability
- **Higher z-index** (z-100) to appear above Sheet overlays
- **Pointer events** enabled for proper click handling
- **Cursor pointer** on date cells for better UX
- **Full-width date picker** button on mobile

#### User Card Improvements
- **Better button spacing** with improved padding
- **Larger icons** on mobile (h-4 w-4) vs desktop (h-3.5 w-3.5)
- **Full-width buttons** on mobile for easier tapping
- **Removed delete button** for safer operations

#### User List Enhancements
- **Better search bar** with larger touch targets (h-10/h-11)
- **Improved action buttons** - full-width on mobile
- **Enhanced selection mode** with better checkbox styling
- **Larger selection indicators** (7×7 on mobile, 6×6 on desktop)
- **Scale animations** on selection for visual feedback

#### Main Page Updates
- **Better header hierarchy** with subtitle
- **Responsive typography** (2xl → 3xl → 4xl)
- **Improved footer** with connection type information
- **Optimized spacing** across all breakpoints

### 🐛 Bug Fixes

1. **Date Calculation**: Fixed timezone issues causing incorrect expiry dates
2. **Calendar Clickability**: Fixed z-index and pointer-events issues
3. **Comment Format**: Preserved original MikroTik comment format
4. **Mobile Navigation**: Fixed calendar month navigation buttons

### 🔧 Technical Changes

#### Component Updates
- `components/mikrotik/pppoe-user-list.tsx` - Sheet integration, mobile layout
- `components/mikrotik/pppoe-user-card.tsx` - Paid button, removed delete
- `components/ui/calendar.tsx` - Mobile-first touch targets
- `components/ui/date-picker.tsx` - Full-width on mobile
- `components/ui/popover.tsx` - Higher z-index (z-100)
- `components/ui/sheet.tsx` - Added for mobile-first modals
- `app/page.tsx` - Improved layout and header

#### Code Quality
- ✅ ESLint: No warnings or errors
- ✅ TypeScript: No type errors
- ✅ All imports cleaned up
- ✅ Unused code removed

### 📱 Responsive Breakpoints
- **Mobile**: Default (< 640px)
- **Tablet**: `sm:` (≥ 640px)
- **Desktop**: `md:` (≥ 768px), `lg:` (≥ 1024px)

### 🚀 Ready for Production
All changes have been tested and validated:
- No linting errors
- No TypeScript errors
- Mobile-first design principles applied
- Accessibility standards met (44px minimum touch targets)
- Proper z-index layering for overlays

---

**Status**: ✅ Ready to deploy
**Date**: November 8, 2025, 7:32 PM UTC+08:00
