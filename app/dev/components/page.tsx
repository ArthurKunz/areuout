'use client'

import { useState } from 'react'
import AddButton from '@/components/shared/AddButton'
import BigButton from '@/components/shared/BigButton'
import DateCard from '@/components/shared/DateCard'
import TimeCard from '@/components/shared/TimeCard'
import MottoCard from '@/components/shared/MottoCard'
import DresscodeCard from '@/components/shared/DresscodeCard'
import Chip from '@/components/shared/Chip'
import ImageUploadCircle from '@/components/shared/ImageUploadCircle'
import ColorSwatchPicker, { type SwatchColor } from '@/components/shared/ColorSwatchPicker'
import SearchInput from '@/components/shared/SearchInput'
import LocationResultsList from '@/components/shared/LocationResultsList'
import LocationCard from '@/components/shared/LocationCard'
import ParticipantsCard from '@/components/shared/ParticipantsCard'
import DescriptionCard from '@/components/shared/DescriptionCard'
import QuestionCard from '@/components/shared/QuestionCard'
import PollCard from '@/components/shared/PollCard'
import RsvpGoingCard from '@/components/shared/RsvpGoingCard'
import MaxParticipantsCard from '@/components/shared/MaxParticipantsCard'
import RsvpMaybeCard from '@/components/shared/RsvpMaybeCard'
import RsvpDeclinedCard from '@/components/shared/RsvpDeclinedCard'
import PollQuestionBanner from '@/components/shared/PollQuestionBanner'
import PollOptionResults from '@/components/shared/PollOptionResults'
import AnswerBubble from '@/components/shared/AnswerBubble'
import IconButton from '@/components/shared/IconButton'
import Input from '@/components/shared/Input'
import InputGroup from '@/components/shared/InputGroup'
import SettingsList from '@/components/shared/SettingsList'
import Toggle from '@/components/shared/Toggle'
import ToggleInput from '@/components/shared/ToggleInput'
import GuestList from '@/features/parties/components/GuestList'
import RsvpInviteBar from '@/features/parties/components/RsvpInviteBar'
import PartyMapPin from '@/features/parties/components/PartyMapPin'
import RsvpStatusButton from '@/features/parties/components/RsvpStatusButton'
import RsvpStatusMenu from '@/features/parties/components/RsvpStatusMenu'
import type { RsvpStatus } from '@/features/parties/types/parties.types'
import { Menu, Pencil } from 'lucide-react'

// Dev-only gallery of the redesign's shared components, rendered live against
// a real background so the glass effects are visible. Not linked from
// anywhere in the app; open it directly at /dev/components.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-4'>
      <h2 className='text-text-1 font-semibold text-heading'>{title}</h2>
      <div className='flex flex-wrap items-start gap-4'>{children}</div>
    </section>
  )
}

export default function ComponentGalleryPage() {
  const [toggleOn, setToggleOn] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [start, setStart] = useState('22:00')
  const [end, setEnd] = useState('04:00')
  const [rsvp, setRsvp] = useState<RsvpStatus>('going')
  const [name, setName] = useState('')
  const [chipSelected, setChipSelected] = useState<Set<string>>(new Set(['maxParticipants']))
  const [swatchColor, setSwatchColor] = useState<SwatchColor>('purple')
  const [locationSearch, setLocationSearch] = useState('')
  const [answer, setAnswer] = useState('')
  const [pollSelected, setPollSelected] = useState(0)

  return (
    <div className='min-h-dvh bg-cover bg-center px-6 py-10' style={{ backgroundImage: 'url(/dev/gallery-bg.jpg)' }}>
      <div className='mx-auto flex max-w-[800px] flex-col gap-10'>
        <h1 className='text-heading-1 font-bold text-heading'>Component Gallery</h1>

        <Section title='DateCard'>
          <DateCard value='26.12.27' />
        </Section>

        <Section title='TimeCard'>
          <TimeCard value='22:00' />
        </Section>

        <Section title='MottoCard'>
          <MottoCard value='Halloween' />
        </Section>

        <Section title='ImageUploadCircle'>
          <ImageUploadCircle onClick={() => {}} />
          <ImageUploadCircle imageUrl='/images/noProfilPicture.jpg' onClick={() => {}} />
        </Section>

        <Section title='ColorSwatchPicker'>
          <ColorSwatchPicker value={swatchColor} onChange={setSwatchColor} />
        </Section>

        <Section title='SearchInput'>
          <SearchInput value={locationSearch} onChange={setLocationSearch} placeholder='Location' />
        </Section>

        <Section title='LocationResultsList'>
          <LocationResultsList
            results={[
              { id: '1', label: 'Bretschneiderstraße 1' },
              { id: '2', label: 'Bretschneiderstraße 13' },
              { id: '3', label: 'Bauhaus 2' },
              { id: '4', label: 'Brenner' },
              { id: '5', label: 'Batze 23' },
              { id: '6', label: 'Bremerstraße 12' },
              { id: '7', label: 'Bauhanf 23' },
            ]}
          />
        </Section>


        <Section title='Chip'>
          {(
            [
              { variant: 'motto', label: 'Motto' },
              { variant: 'maxParticipants', label: 'max. Teilnehmer' },
              { variant: 'poll', label: 'Umfrage' },
              { variant: 'dresscode', label: 'Dresscode' },
              { variant: 'question', label: 'Frage' },
              { variant: 'description', label: 'Beschreibung' },
            ] as const
          ).map(({ variant, label }) => (
            <Chip
              key={variant}
              variant={variant}
              selected={chipSelected.has(variant)}
              onClick={() => setChipSelected((prev) => new Set(prev).add(variant))}
              onRemove={() =>
                setChipSelected((prev) => {
                  const next = new Set(prev)
                  next.delete(variant)
                  return next
                })
              }
            >
              {label}
            </Chip>
          ))}
        </Section>

        <Section title='DresscodeCard'>
          <DresscodeCard value='Verkleidung' />
        </Section>

        <Section title='LocationCard'>
          <LocationCard address='Bretschneiderstraße 14' />
        </Section>

        <Section title='ParticipantsCard'>
          <ParticipantsCard count={28} />
        </Section>

        <Section title='DescriptionCard'>
          <DescriptionCard text='Hier kommt dann einfach eine Fläche hin wo man einfach infos eintragen kann die wichtig sind zu wissen. Bspw. Beschreibung.' />
        </Section>

        <Section title='QuestionCard'>
          <QuestionCard
            question='Bringst du was mit?'
            value={answer}
            onChange={setAnswer}
            placeholder='z.B. bringe Chips mit'
          />
        </Section>

        <Section title='Gästeliste-Stats (RsvpGoingCard, MaxParticipantsCard, RsvpMaybeCard, RsvpDeclinedCard)'>
          <RsvpGoingCard value={26} />
          <MaxParticipantsCard value={50} />
          <RsvpMaybeCard value={2} />
          <RsvpDeclinedCard value={12} />
        </Section>

        <Section title='RsvpInviteBar'>
          <RsvpInviteBar />
        </Section>

        <Section title='GuestList'>
          <GuestList
            guests={[
              { id: '1', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz', status: 'going' },
              { id: '2', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz', status: 'going' },
              { id: '3', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz', status: 'maybe' },
              { id: '4', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz', status: 'not_going' },
              { id: '5', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz', status: 'not_going' },
            ]}
          />
        </Section>

        <Section title='Umfrage-Ergebnisse (PollQuestionBanner, PollOptionResults)'>
          <div className='flex w-[350px] flex-col gap-4'>
            <PollQuestionBanner question='Bringst du was mit?' />
            <PollOptionResults
              label='Ja'
              votes={2}
              voters={[
                { id: '1', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz' },
                { id: '2', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz' },
              ]}
            />
            <PollOptionResults
              label='Nein'
              votes={2}
              voters={[
                { id: '3', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz' },
                { id: '4', avatarUrl: '/images/noProfilPicture.jpg', name: 'Arthur Kunz' },
              ]}
            />
            <PollOptionResults label='Vielleicht' votes={0} voters={[]} />
          </div>
        </Section>

        <Section title='AnswerBubble'>
          <div className='flex w-[350px] flex-col gap-4'>
            <AnswerBubble name='Alfred Klemm' text='Bringst du was mit?' variant='other' />
            <AnswerBubble name='Arthur Kunz' text='Bringe Chips mit' variant='own' />
            <AnswerBubble name='Max Mustermann' text='Bringe Bier mit' variant='other' />
            <AnswerBubble name='Mathias Steinbeck' text='Bringe Kekse mit' variant='other' />
          </div>
        </Section>

        <Section title='PollCard'>
          <PollCard
            question='Bringst du was mit?'
            options={[
              { label: 'Ja', percent: 15 },
              { label: 'Nein', percent: 80 },
              { label: 'Vielleicht', percent: 60 },
            ]}
            selectedIndex={pollSelected}
            onSelect={setPollSelected}
          />
        </Section>

        <Section title='AddButton'>
          <AddButton label='Frage hinzufügen' />
        </Section>

        <Section title='BigButton'>
          <BigButton variant='white'>Anfragen</BigButton>
          <BigButton variant='red'>Account löschen</BigButton>
          <BigButton variant='green'>Zusagen</BigButton>
          <BigButton variant='main'>Sign up</BigButton>
        </Section>

        <Section title='IconButton'>
          <IconButton icon={Menu} label='Menü' />
          <IconButton icon={Pencil} label='Bearbeiten' />
        </Section>

        <Section title='Input'>
          <Input label='Name' value={inputValue} onChange={setInputValue} placeholder='Party-Name' />
        </Section>

        <Section title='InputGroup'>
          <InputGroup
            rows={[
              { label: 'Start', value: start, onChange: setStart },
              { label: 'Ende', value: end, onChange: setEnd },
            ]}
          />
        </Section>

        <Section title='SettingsList'>
          <SettingsList
            rows={[
              { label: 'Name', value: name, onChange: setName, placeholder: 'Dein Name' },
              { label: 'Password', onClick: () => {} },
              { label: 'Account verwalten', onClick: () => {} },
              { label: 'Rechtliches', onClick: () => {} },
            ]}
          />
        </Section>

        <Section title='Toggle'>
          <Toggle checked={toggleOn} onChange={setToggleOn} label='Sichtbarkeit' />
        </Section>

        <Section title='ToggleInput'>
          <ToggleInput label='Endzeit' checked={toggleOn} onChange={setToggleOn} />
        </Section>

        <Section title='PartyMapPin'>
          <PartyMapPin imageUrl='/images/noProfilPicture.jpg' alt='Party' />
          <PartyMapPin imageUrl='/images/noProfilPicture.jpg' alt='Party' active />
        </Section>

        <Section title='RsvpStatusButton'>
          <RsvpStatusButton status='going' />
          <RsvpStatusButton status='maybe' />
          <RsvpStatusButton status='not_going' />
        </Section>

        <Section title='RsvpStatusMenu'>
          <div className='relative h-[115px]'>
            <RsvpStatusMenu status={rsvp} onSelect={setRsvp} />
          </div>
        </Section>
      </div>
    </div>
  )
}
