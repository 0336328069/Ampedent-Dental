'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

import {
  formatDate,
  formatTime,
  incrementTimeByOneHour,
} from '@/lib/dateAndTimeUtils'
import SuccessBox from './SuccessBox'
import BookingHeader from './BookingHeader'

// Validation schema using Yup
const bookingSchema = yup.object({
  firstName: yup
    .string()
    .required('First name is required')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/, 'First name can only contain letters and spaces')
    .min(2, 'First name must be at least 2 characters'),
  lastName: yup
    .string()
    .required('Last name is required')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/, 'Last name can only contain letters and spaces')
    .min(2, 'Last name must be at least 2 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
  phone: yup
    .string()
    .required('Phone number is required')
    .matches(/^[0-9+\-\(\)\s]+$/, 'Phone number can only contain numbers and special characters')
    .min(8, 'Phone number must be at least 8 characters'),
  date: yup
    .date()
    .required('Date is required')
    .min(new Date(), 'Date must be in the present or future'),
  time: yup
    .string()
    .required('Please select a time slot'),
  message: yup
    .string()
    .optional()
})

type BookingFormData = yup.InferType<typeof bookingSchema>

function BookingForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [bookingData, setBookingData] = useState<{ date: Date | null; time: string }>({ date: null, time: '' })
  const successBoxRef = useRef<HTMLDivElement | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset
  } = useForm<BookingFormData>({
    resolver: yupResolver(bookingSchema),
    mode: 'onChange'
  })

  const watchedDate = watch('date')

  const now = new Date()
  let defaultDate = new Date()

  if (now.getHours() >= 16 || (now.getHours() === 16 && now.getMinutes() > 0)) {
    defaultDate.setDate(now.getDate() + 1)
  }

  if (defaultDate.getDay() === 0) {
    defaultDate.setDate(defaultDate.getDate() + 1)
  } else if (defaultDate.getDay() === 6) {
    defaultDate.setDate(defaultDate.getDate() + 2)
  }

  // Set default date
  useEffect(() => {
    setValue('date', defaultDate)
  }, [setValue])

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
    const now = new Date()
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear() &&
      now.getHours() >= 16
    ) {
      return false
    }
    return true
  }

  // Fetch available times when date changes
  useEffect(() => {
    if (watchedDate) {
      const fetchAvailableTimes = async () => {
        try {
          // Convert date to YYYY-MM-DD format
          const dateString = watchedDate.toISOString().split('T')[0]
          
          const res = await fetch(`/api/availability?date=${dateString}`)
          if (res.ok) {
            const data = await res.json()
            setAvailableTimes(data.availableTimes)
            if (data.availableTimes.length > 0) {
              setValue('time', data.availableTimes[0])
            } else {
              setValue('time', '')
            }
          }
        } catch (err: any) {
          setError(err.message)
        }
      }
      fetchAvailableTimes()
    }
  }, [watchedDate, setValue])

  const onSubmit = async (data: BookingFormData) => {
    try {
      setIsLoading(true)
      setError('')
      
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        // Save booking data before reset
        setBookingData({ date: data.date, time: data.time })
        setCreated(true)
        reset()
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'An error occurred while booking')
      }
    } catch (err: any) {
      setError('An error occurred while booking')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (created && successBoxRef.current) {
      successBoxRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [created])

  return (
    <section className='max-w-3xl w-full min-h-lvh mx-auto flex items-center justify-center p-4'>
      <div>
        {created && (
          <SuccessBox ref={successBoxRef}>
            <div className='my-8'>
              <h1 className='text-center mb-8 text-3xl font-bold md:text-5xl'>
                Appointment created
              </h1>
              <p className='mx-auto text-lg mb-8 mt-4  text-slate-600 md:mb-16'>
                Thank you! Your appointment has been successfully booked. <br />
                We look forward to seeing you on{' '}
                {formatDate(bookingData.date?.toString() || '')} at{' '}
                {formatTime(bookingData.time || '')} -{' '}
                {incrementTimeByOneHour(bookingData.time || '')}. <br />
                If you have any questions or need to make changes, please
                contact us at <br />
                <span className='font-bold'>ampedent@example.com</span> or call
                us at <span className='font-bold'>+1234567890</span>
                <br />
              </p>
            </div>
          </SuccessBox>
        )}
        {!created && (
          <>
            <BookingHeader />
            {error && <p className='text-red-600 text-center mb-4'>{error}</p>}

            <form className='mx-auto' onSubmit={handleSubmit(onSubmit)}>
              <div className='grid md:grid-cols-2 gap-4 items-center'>
                <div>
                  <label htmlFor='firstName'>
                    First name
                    <span className='text-red-600 ml-1'>*</span>
                  </label>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        disabled={isLoading}
                        type='text'
                        id='firstName'
                        className={errors.firstName ? 'border-red-500' : ''}
                        placeholder="Enter your first name"
                      />
                    )}
                  />
                  {errors.firstName && (
                    <p className='text-red-500 text-sm mt-1'>{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor='lastName'>
                    Last name
                    <span className='text-red-600 ml-1'>*</span>
                  </label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        disabled={isLoading}
                        type='text'
                        id='lastName'
                        className={errors.lastName ? 'border-red-500' : ''}
                        placeholder="Enter your last name"
                      />
                    )}
                  />
                  {errors.lastName && (
                    <p className='text-red-500 text-sm mt-1'>{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              
              <div className='flex flex-col my-4'>
                <label htmlFor='email'>
                  Email
                  <span className='text-red-600 ml-1'>*</span>
                </label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      disabled={isLoading}
                      type='email'
                      id='email'
                      className={errors.email ? 'border-red-500' : ''}
                      placeholder="example@email.com"
                    />
                  )}
                />
                {errors.email && (
                  <p className='text-red-500 text-sm mt-1'>{errors.email.message}</p>
                )}
              </div>
              
              <div className='flex flex-col my-4'>
                <label htmlFor='phone'>
                  Phone
                  <span className='text-red-600 ml-1'>*</span>
                </label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      disabled={isLoading}
                      type='text'
                      id='phone'
                      className={errors.phone ? 'border-red-500' : ''}
                      placeholder="0912345678"
                    />
                  )}
                />
                {errors.phone && (
                  <p className='text-red-500 text-sm mt-1'>{errors.phone.message}</p>
                )}
              </div>

              <div className='grid md:grid-cols-2 gap-4 items-center'>
                <div className='flex flex-col'>
                  <label htmlFor='date' className='mb-[2px]'>
                    Date
                    <span className='text-red-600 ml-1'>*</span>
                  </label>
                  <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id='date'
                        disabled={isLoading}
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                        name={field.name}
                        dateFormat='dd MMMM yyyy'
                        filterDate={filterDates}
                        className={errors.date ? 'border-red-500' : ''}
                        placeholderText="Select date"
                      />
                    )}
                  />
                  {errors.date && (
                    <p className='text-red-500 text-sm mt-1'>{errors.date.message}</p>
                  )}
                </div>
                <div className='flex flex-col'>
                  <label htmlFor='time' className='mb-[2px]'>
                    Time
                    <span className='text-red-600 ml-1'>*</span>
                  </label>
                  <Controller
                    name="time"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        disabled={isLoading}
                        id='time'
                        className={`appearance-none bg-white ${errors.time ? 'border-red-500' : ''}`}
                        >
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
                  {errors.time && (
                    <p className='text-red-500 text-sm mt-1'>{errors.time.message}</p>
                  )}
                </div>
              </div>

              <div className='flex flex-col my-4'>
                <label htmlFor='message'>Message</label>
                <Controller
                  name="message"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      disabled={isLoading}
                      id='message'
                      cols={30}
                      rows={10}
                      placeholder='Enter any specific requests or additional information here...'
                    />
                  )}
                />
              </div>
              
              <button
                type='submit'
                className='rounded px-6 py-3 text-center font-semibold text-white bg-blue-600 hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed'
                disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
export default BookingForm
