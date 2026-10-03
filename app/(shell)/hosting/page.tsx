import ListHeader from '@/components/shell/ListHeader'
import HostingList from '@/features/hosting/HostingList'

export default function HostingPage() {
  return (
    <>
      <ListHeader title='Hosting' />
      {/* The bottom padding lets the list scroll out from under the navigation. */}
      <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-25'>
        <HostingList />
      </div>
    </>
  )
}
