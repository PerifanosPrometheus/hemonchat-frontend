'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import LoadingModal from '../components/LoadingModal'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showLoadingModal, setShowLoadingModal] = useState(true)
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [lastCheckTime, setLastCheckTime] = useState<number>(0)
  const checkTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const checkModelStatus = async () => {
      try {
        const currentTime = Date.now()
        // Only check if it's been at least 60 seconds since the last check
        if (currentTime - lastCheckTime < 60000 && lastCheckTime !== 0) {
          return
        }
        
        console.log('Checking model status at:', `${API_URL}/model-status`)
        setLastCheckTime(currentTime)
        
        const response = await fetch(`${API_URL}/model-status`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': window.location.origin,
          },
          mode: 'cors',
          cache: 'no-cache',
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('Model status response:', data)
        
        if (data.status) {
          setModelStatus('ready')
          // Clear any pending timeout when model is ready
          if (checkTimeoutRef.current) {
            clearTimeout(checkTimeoutRef.current)
          }
        } else {
          // Schedule next check in 60 seconds
          if (checkTimeoutRef.current) {
            clearTimeout(checkTimeoutRef.current)
          }
          checkTimeoutRef.current = setTimeout(checkModelStatus, 60000)
        }
      } catch (error: any) {
        console.error('Model status check failed:', {
          error,
          message: error.message,
          type: error.name,
          url: `${API_URL}/model-status`,
          origin: window.location.origin
        })
        
        setModelStatus('error')
        // Retry in 60 seconds even on error
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current)
        }
        checkTimeoutRef.current = setTimeout(checkModelStatus, 60000)
      }
    }

    checkModelStatus()

    // Cleanup function to clear timeout
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }
    }
  }, [])

  // Handle form submission and manage streaming response
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Create a placeholder for the assistant's message
    const assistantMessage: Message = {
      role: 'assistant',
      content: ''
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage]
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Network response was not ok')
      }
      
      // Set up SSE stream handling
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      // Buffer for handling partial messages
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Convert the chunk to text and add to buffer
        const text = new TextDecoder().decode(value)
        buffer += text
        console.log('Received text:', text)
        
        // Process complete messages
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''
        
        for (const message of messages) {
          if (message.startsWith('data: ')) {
            try {
              const data = JSON.parse(message.slice(6))
              console.log('Parsed data:', data)
              
              if (data.content !== undefined) {
                // Use functional update to ensure we're working with the latest state
                setMessages(prev => {
                  // Create a new array with all but the last message
                  const newMessages = [...prev.slice(0, -1)]
                  // Get the last message or create a new one if none exists
                  const lastMessage = prev[prev.length - 1] || { role: 'assistant', content: '' }
                  // Add the updated last message
                  newMessages.push({
                    ...lastMessage,
                    content: lastMessage.content + data.content
                  })
                  return newMessages
                })
              }
            } catch (e) {
              console.error('Error parsing chunk:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage.role === 'assistant') {
          lastMessage.content = 'Sorry, an error occurred. Please try again.'
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestart = () => {
    setMessages([])
    setInput('')
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {showLoadingModal ? (
        <LoadingModal 
          status={modelStatus} 
          onClose={() => setShowLoadingModal(false)} 
        />
      ) : (
        modelStatus === 'loading' && (
          <div className="fixed top-20 left-0 right-0 bg-blue-500/10 text-white py-3 px-4">
            <div className="max-w-4xl mx-auto flex items-center space-x-3">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <p>AI model is warming up, this usually takes 3-5 minutes...</p>
            </div>
          </div>
        )
      )}
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-gray-900/80 backdrop-blur-sm p-4 border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ChatBubbleLeftIcon className="h-6 w-6 text-blue-500" />
            </div>
            <h1 className="text-xl font-bold text-white">HemonChat</h1>
          </div>
          
          <button
            onClick={handleRestart}
            disabled={modelStatus !== 'ready'}
            className="p-2 text-gray-400 hover:text-white transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto pt-20 pb-24">
        <div className="space-y-6 px-4 py-8 relative">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <h2 className="text-2xl font-semibold mb-3 text-white">Welcome to HemonChat</h2>
              <p className="text-gray-400 max-w-md mx-auto">Your AI assistant for hematology and oncology. Ask me anything about treatments, diagnoses, or medical concepts.</p>
            </div>
          )}
          
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                exit={{ opacity: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                      : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-100'
                  } transition-all duration-200 hover:shadow-2xl whitespace-pre-line`}
                >
                  {message.content}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl px-5 py-3 text-gray-100 shadow-xl">
                  <span className="inline-flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse"></span>
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-150"></span>
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-300"></span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 w-full bg-gray-900/80 backdrop-blur-md p-4 border-t border-gray-800/50"
      >
        <div className="max-w-4xl mx-auto flex gap-4">
          <div className="flex-1 relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about hematology/oncology..."
              disabled={modelStatus !== 'ready'}
              className="w-full rounded-xl bg-gray-800 px-4 py-3 text-white placeholder-gray-400 
                       border border-gray-700 focus:border-blue-500
                       focus:outline-none focus:ring-1 focus:ring-blue-500
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {modelStatus !== 'ready' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg
                            opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap
                            border border-gray-700 shadow-lg">
                Please wait while the AI model is loading...
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              type="submit"
              disabled={isLoading || modelStatus !== 'ready'}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-white
                       hover:from-blue-500 hover:to-blue-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       disabled:from-gray-600 disabled:to-gray-700
                       disabled:hover:from-gray-600 disabled:hover:to-gray-700
                       transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
            {modelStatus !== 'ready' && (
              <div className="absolute bottom-full mb-2 right-0 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg
                            opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap
                            border border-gray-700 shadow-lg">
                Please wait while the AI model is loading...
              </div>
            )}
          </div>
        </div>
      </form>
    </main>
  )
} 