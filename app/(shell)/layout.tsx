import ShellMap from '@/components/shell/ShellMap'
import MapDebug from '@/components/shell/MapDebug'
import Shell from '@/components/shell/Shell'
import { MapProvider } from '@/components/shell/MapContext'

// Shared by every redesigned screen. Next keeps a layout mounted while its child routes
// change, so the map is created once and survives every tab switch. MapProvider lets
// the screens inside Shell move that map.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapProvider>
      <ShellMap />
      <Shell>{children}</Shell>
      {/* TEMPORARY, see MapDebug.tsx */}
      <MapDebug />
    </MapProvider>
  )
}
