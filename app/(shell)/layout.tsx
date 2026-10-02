import ShellMap from '@/components/shell/ShellMap'
import Shell from '@/components/shell/Shell'

// Shared by every redesigned screen. Next keeps a layout mounted while its child routes
// change, so the map is created once and survives every tab switch.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ShellMap />
      <Shell>{children}</Shell>
    </>
  )
}
