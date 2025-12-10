'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Plus, MessageSquare, Search, Loader2 } from 'lucide-react'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  lastMessage: string
}

const AGENT_ID = '6939a09c5a8dda74db9ccca4'

const STARTER_PROMPTS = [
  'What is machine learning?',
  'How can I improve my productivity?',
  'Explain quantum computing in simple terms',
  'What are best practices for web development?',
]

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chatbot_conversations')
    if (saved) {
      const parsed = JSON.parse(saved)
      setConversations(parsed)
      if (parsed.length > 0) {
        setCurrentConversationId(parsed[0].id)
      }
    }
  }, [])

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('chatbot_conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConversationId, conversations])

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      lastMessage: '',
    }
    setConversations([newConversation, ...conversations])
    setCurrentConversationId(newConversation.id)
    setInputValue('')
  }

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || !currentConversationId) return

    setIsLoading(true)

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
    }

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === currentConversationId) {
          const updatedMessages = [...conv.messages, userMessage]
          return {
            ...conv,
            messages: updatedMessages,
            lastMessage: messageText,
            title: conv.messages.length === 0 ? messageText.slice(0, 50) : conv.title,
          }
        }
        return conv
      })
    )
    setInputValue('')

    try {
      // Get conversation history
      const conversationHistory = currentConversation?.messages || []
      const context = conversationHistory
        .slice(-10)
        .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n')

      const fullMessage = context ? `${context}\nUser: ${messageText}` : messageText

      // Call AI agent
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullMessage,
          agent_id: AGENT_ID,
          user_id: 'chatbot-user',
          session_id: currentConversationId,
        }),
      })

      const data = await response.json()

      // Get the agent response with multiple fallback strategies
      let agentResponseText = ''

      if (data.success) {
        agentResponseText =
          data.response?.result ||
          data.response?.answer ||
          data.response?.response ||
          (typeof data.response === 'string' ? data.response : null) ||
          data.raw_response ||
          'No response received'
      } else {
        agentResponseText = data.raw_response || 'Error processing request'
      }

      // Add agent response
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: agentResponseText,
        sender: 'agent',
        timestamp: new Date().toISOString(),
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: [...conv.messages, agentMessage],
              lastMessage: agentResponseText,
            }
          }
          return conv
        })
      )
    } catch (error) {
      console.error('Error sending message:', error)

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: 'Sorry, an error occurred while processing your message. Please try again.',
        sender: 'agent',
        timestamp: new Date().toISOString(),
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: [...conv.messages, errorMessage],
              lastMessage: 'Error',
            }
          }
          return conv
        })
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      sendMessage(inputValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim()) {
        sendMessage(inputValue)
      }
    }
  }

  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const deleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    if (currentConversationId === id) {
      setCurrentConversationId(updated.length > 0 ? updated[0].id : null)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <div
        className={`flex flex-col w-64 bg-gray-900 border-r border-gray-700 transition-all duration-300 ${
          !sidebarOpen ? '-ml-64' : ''
        }`}
      >
        <div className="p-4 border-b border-gray-700">
          <Button onClick={createNewConversation} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No conversations yet</p>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setCurrentConversationId(conv.id)}
                  className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-gray-800 border border-blue-600'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-white truncate">{conv.title}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{conv.lastMessage}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(conv.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(conv.id)
                      }}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-gray-300" />
            </button>
            <h1 className="text-xl font-bold text-white">Knowledge Base Chatbot</h1>
          </div>
          {currentConversation && (
            <p className="text-sm text-gray-400">{currentConversation.messages.length} messages</p>
          )}
        </div>

        {/* Messages Area */}
        {!currentConversationId || !currentConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Start a conversation</h2>
              <p className="text-gray-400 mb-6">Click on a conversation or create a new one to begin</p>
              <Button onClick={createNewConversation} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto px-6 py-6">
              {currentConversation.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 mb-12">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-4">What would you like to know?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {STARTER_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(prompt)}
                          disabled={isLoading}
                          className="p-3 text-left border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <p className="text-sm font-medium text-gray-100">{prompt}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 mb-12">
                  {currentConversation.messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-2xl px-4 py-3 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-gray-800 text-gray-100 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                        <p
                          className={`text-xs mt-2 ${
                            message.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                          }`}
                        >
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800 text-gray-100 px-4 py-3 rounded-lg rounded-bl-none">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        {currentConversationId && (
          <div className="border-t border-gray-700 bg-gray-900 p-6">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  disabled={isLoading}
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
