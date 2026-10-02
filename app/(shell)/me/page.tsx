import ListHeader from '@/components/shell/ListHeader'

export default function ProfilePage() {
  return (
    <>
      <ListHeader title='Profile' plus={false} />
      {/* Placeholder until the content arrives in a later step. The bottom padding lets
          the list scroll out from under the navigation. */}
      <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-25'>
        <p className='text-text-3 text-text'>Nothing here yet.</p>
      </div>
    </>
  )
}
