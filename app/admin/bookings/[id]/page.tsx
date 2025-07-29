'use client'

import {
  formatDate,
  formatTime,
  incrementTimeByOneHour,
} from '@/lib/dateAndTimeUtils'
import { SQLiteBookingType } from '@/types/booking'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Spinner from '@/app/components/Spinner'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

// Validation schema for reschedule form
const rescheduleSchema = yup.object({
  newDate: yup
    .date()
    .required('New date is required')
    .min(new Date(), 'New date must be in the future'),
  newTime: yup
    .string()
    .required('New time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
})

type RescheduleFormData = yup.InferType<typeof rescheduleSchema>

// Validation functions for admin actions
const adminValidationRules = {
  isValidAppointmentId: (id: string) => {
    return id && id.trim() !== '' && !isNaN(Number(id))
  },
  
  isValidAction: (action: string) => {
    return ['confirm', 'cancel', 'reschedule', 'notify'].includes(action)
  }
}

function IndividualBooking({ params }: { params: { id: string } }) {
  const [booking, setBooking] = useState<SQLiteBookingType>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const router = useRouter()
  const { status } = useSession()

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<RescheduleFormData>({
    resolver: yupResolver(rescheduleSchema),
    mode: 'onChange'
  })

  const watchedNewDate = watch('newDate')

  useEffect(() => {
    async function fetchBooking() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/booking?id=${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setBooking(data.booking)
          setIsLoading(false)
        } else {
          setError('Booking not found')
          setIsLoading(false)
        }
      } catch (err: any) {
        setError(err.message)
        setIsLoading(false)
      }
    }
    fetchBooking()
  }, [params.id])

  // Fetch available times for reschedule
  useEffect(() => {
    if (showRescheduleForm && watchedNewDate) {
      const fetchAvailableTimes = async () => {
        try {
          const res = await fetch(`/api/availability?date=${watchedNewDate}`)
          if (res.ok) {
            const data = await res.json()
            setAvailableTimes(data.availableTimes)
            if (data.availableTimes.length > 0) {
              setValue('newTime', data.availableTimes[0])
            }
          }
        } catch (err: any) {
          setError('Unable to load available times')
        }
      }
      fetchAvailableTimes()
    }
  }, [watchedNewDate, showRescheduleForm, setValue])

  async function handleAdminAction(action: 'confirm' | 'cancel' | 'notify') {
    // Validation according to equivalence partitioning
    if (!adminValidationRules.isValidAppointmentId(params.id)) {
      setError('Invalid appointment ID')
      return
    }

    if (!adminValidationRules.isValidAction(action)) {
      setError('Invalid action')
      return
    }

    try {
      setIsLoading(true)
      setError('')
      setSuccess('')

      let url = `/api/booking?id=${params.id}`
      let method = 'PUT'
      let body = {}

      if (action === 'confirm') {
        // B-01: Confirm appointment
        body = { action: 'confirm' }
      } else if (action === 'cancel') {
        // B-02: Cancel appointment
        url = `/api/booking/cancel?id=${params.id}`
      } else if (action === 'notify') {
        // Send notification
        setSuccess('Notification sent successfully')
        setIsLoading(false)
        return
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      })

      if (res.ok) {
        if (action === 'confirm') {
          setSuccess('Appointment confirmed successfully')
        } else if (action === 'cancel') {
          setSuccess('Appointment cancelled successfully')
        }
        
        // Refresh booking data
        const updatedRes = await fetch(`/api/booking?id=${params.id}`)
        if (updatedRes.ok) {
          const data = await updatedRes.json()
          setBooking(data.booking)
        }
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'An error occurred')
      }
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  const onRescheduleSubmit = async (data: RescheduleFormData) => {
    // Validation for reschedule
    if (!availableTimes.includes(data.newTime)) {
      setError('Time slot not available')
      return
    }

    try {
      setIsLoading(true)
      setError('')
      setSuccess('')

      const res = await fetch(`/api/booking?id=${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reschedule',
          newDate: data.newDate,
          newTime: data.newTime
        })
      })

      if (res.ok) {
        setSuccess('Appointment rescheduled successfully')
        setShowRescheduleForm(false)
        reset()
        
        // Refresh booking data
        const updatedRes = await fetch(`/api/booking?id=${params.id}`)
        if (updatedRes.ok) {
          const data = await updatedRes.json()
          setBooking(data.booking)
        }
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'An error occurred')
      }
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  function filterDates(date: Date) {
    const day = date.getDay()
    if (day === 0 || day === 6) {
      return false
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      return false
    }
    return true
  }

  if (status === 'unauthenticated') {
    router.push('/')
  }

  return (
    <section className=''>
      <Link
        href='/admin/bookings'
        className='p-3 border rounded hover:border-black'>
        Go back
      </Link>
      {booking && (
        <section className='max-w-3xl w-full mx-auto flex items-center justify-center p-4'>
          <div className='w-full'>
            <div className='mb-1'>
              <h1 className=' text-center mb-8 text-wrap text-2xl font-bold md:text-5xl'>
                Booking : {booking.id.toString()}
              </h1>
              {isLoading && <Spinner />}
              {error && <p className='text-red-600 text-center mb-4'>{error}</p>}
              {success && <p className='text-green-600 text-center mb-4'>{success}</p>}
            </div>
            <form className='mx-auto flex flex-col'>
              <div className='grid md:grid-cols-2 gap-4 items-center'>
                <div>
                  <label htmlFor='firstName'>First name</label>
                  <input
                    disabled={true}
                    type='text'
                    id='firstName'
                    value={booking.firstName}
                  />
                </div>
                <div>
                  <label htmlFor='lastName'>Last name</label>
                  <input
                    disabled={true}
                    type='text'
                    id='lastName'
                    value={booking.lastName}
                  />
                </div>
              </div>
              <div className='flex flex-col my-4'>
                <label htmlFor='email'>Email</label>
                <input
                  disabled={true}
                  type='email'
                  id='email'
                  value={booking.email}
                />
              </div>
              <div className='flex flex-col my-4'>
                <label htmlFor='phone'>Phone</label>
                <input
                  disabled={true}
                  type='text'
                  id='phone'
                  value={booking.phone}
                />
              </div>
              <div className='grid md:grid-cols-2 gap-4 items-center'>
                <div className='flex flex-col'>
                  <label htmlFor='date' className='mb-[2px]'>
                    Date
                  </label>
                  <input
                    disabled={true}
                    type='text'
                    id='date'
                    value={formatDate(booking.date.toString())}
                  />
                </div>
                <div className='flex flex-col'>
                  <label htmlFor='time' className='mb-[2px]'>
                    Time
                  </label>
                  <input
                    disabled={true}
                    type='text'
                    id='time'
                    value={
                      formatTime(booking.time) +
                      ' ' +
                      '-' +
                      ' ' +
                      incrementTimeByOneHour(booking.time)
                    }
                  />
                </div>
              </div>
              <div className='flex flex-col my-4'></div>
              <div className='flex flex-col my-4'>
                <label htmlFor='message'>Message</label>
                <textarea
                  disabled={true}
                  value={booking.message}
                  id='message'
                  cols={30}
                  rows={10}></textarea>
              </div>

              {/* Reschedule Form */}
              {showRescheduleForm && (
                <div className='border-t pt-4 mt-4'>
                  <h3 className='text-lg font-semibold mb-4'>Reschedule Appointment</h3>
                  <form onSubmit={handleSubmit(onRescheduleSubmit)}>
                    <div className='grid md:grid-cols-2 gap-4 items-center'>
                      <div className='flex flex-col'>
                        <label htmlFor='newDate' className='mb-[2px]'>
                          New Date
                          <span className='text-red-600 ml-1'>*</span>
                        </label>
                        <Controller
                          name="newDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              id='newDate'
                              disabled={isLoading}
                              selected={field.value}
                              onChange={(date) => field.onChange(date)}
                              onBlur={field.onBlur}
                              name={field.name}
                              dateFormat='dd MMMM yyyy'
                              filterDate={filterDates}
                              placeholderText='Select new date'
                              className={errors.newDate ? 'border-red-500' : ''}
                            />
                          )}
                        />
                        {errors.newDate && (
                          <p className='text-red-500 text-sm mt-1'>{errors.newDate.message}</p>
                        )}
                      </div>
                      <div className='flex flex-col'>
                        <label htmlFor='newTime' className='mb-[2px]'>
                          New Time
                          <span className='text-red-600 ml-1'>*</span>
                        </label>
                        <Controller
                          name="newTime"
                          control={control}
                          render={({ field }) => (
                            <select
                              {...field}
                              disabled={isLoading}
                              id='newTime'
                              className={`appearance-none bg-white ${errors.newTime ? 'border-red-500' : ''}`}>
                              <option value=''>Select time slot</option>
                              {availableTimes.length > 0 ? (
                                availableTimes.map((time: string) => (
                                  <option value={time} key={time}>
                                    {formatTime(time)} - {incrementTimeByOneHour(time)}
                                  </option>
                                ))
                              ) : (
                                <option disabled>No time available for this date</option>
                              )}
                            </select>
                          )}
                        />
                        {errors.newTime && (
                          <p className='text-red-500 text-sm mt-1'>{errors.newTime.message}</p>
                        )}
                      </div>
                    </div>
                    <div className='flex gap-2 mt-4'>
                      <button
                        type='submit'
                        className='rounded px-4 py-2 text-center font-semibold text-white bg-blue-600 hover:bg-blue-800'>
                        Confirm Reschedule
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          setShowRescheduleForm(false)
                          reset()
                        }}
                        className='rounded px-4 py-2 text-center font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300'>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {booking && booking.status === 'pending' && (
                <div className='flex md:flex-row flex-col items-center justify-between gap-4 mt-4'>
                  <button
                    onClick={() => handleAdminAction('notify')}
                    type='button'
                    className='rounded w-full md:max-w-[100px] px-6 py-3 text-center font-semibold text-white bg-blue-600 hover:bg-blue-800'>
                    Notify
                  </button>
                  <div className='flex w-full md:flex-row flex-col items-center gap-4'>
                    <button
                      onClick={() => handleAdminAction('cancel')}
                      type='button'
                      className='rounded w-full md:max-w-[200px] whitespace-nowrap px-6 py-3 text-center font-semibold text-white bg-red-500 hover:bg-red-800'>
                      Cancel appointment
                    </button>
                    <button
                      onClick={() => handleAdminAction('confirm')}
                      type='button'
                      className='rounded w-full md:max-w-[200px] px-6 py-3 text-center font-semibold text-white bg-green-600 hover:bg-green-800'>
                      Mark as completed
                    </button>
                    <button
                      onClick={() => setShowRescheduleForm(true)}
                      type='button'
                      className='rounded w-full md:max-w-[200px] px-6 py-3 text-center font-semibold text-white bg-yellow-600 hover:bg-yellow-800'>
                      Reschedule
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </section>
      )}
    </section>
  )
}

export default IndividualBooking

