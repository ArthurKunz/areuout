'use client'

import type { Profile } from '@/features/profile/services/profile.service'
import type { Question } from '../types/parties.types'
import QuestionCard from './QuestionCard'

export default function QuestionsSection({
  questions,
  userId,
  myProfile,
  onRefresh,
}: {
  questions: Question[]
  userId: string
  myProfile: Profile | null
  onRefresh: () => void
}) {
  return (
    <div className='flex flex-col gap-4'>
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          userId={userId}
          myProfile={myProfile}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}
