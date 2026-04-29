import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './index.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
  image?: string
  artifacts?: Artifact[]
}

interface Artifact {
  type: string
  title: string
  content: string
}

const API = 'http://localhost:8000'

const SUGGESTED = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "What polarity do I need for TIG welding?",
  "I'm getting porosity in my flux-cored welds.",
  "How do I set up for stick welding?",
  "What wire speed should I use for 1/4\" steel?",
  "Walk me through the front panel controls.",
]

function ArtifactPanel({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: '520px', height: '100vh',
      background: '#111', borderLeft: '1px solid #222',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      animation: 'slideIn 0.25s ease'
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #222',
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#f97316'
        }} />
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '12px', color: '#f97316',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{artifact.title}</span>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px',
          color: '#666', cursor: 'pointer', padding: '4px 10px', fontSize: '12px',
          fontFamily: 'IBM Plex Mono'
        }}>close</button>
      </div>
      <iframe
        srcDoc={artifact.content}
        style={{ flex: 1, border: 'none', background: '#1a1a1a' }}
        sandbox="allow-scripts"
      />
    </div>
  )
}

function ArtifactChip({ artifact, onClick }: { artifact: Artifact; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px',
      background: '#1a0e00', border: '1px solid #7c3910',
      borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
      color: '#f97316', fontFamily: 'IBM Plex Mono', fontSize: '12px',
      transition: 'all 0.15s', width: '100%', textAlign: 'left'
    }}
    onMouseEnter={e => (e.currentTarget.style.background = '#231200')}
    onMouseLeave={e => (e.currentTarget.style.background = '#1a0e00')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="#f97316" strokeWidth="1.2"/>
        <path d="M4 7h6M7 4v6" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      {artifact.title}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 'auto' }}>
        <path d="M2 8L8 2M8 2H4M8 2v4" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

function MessageBubble({ msg, onArtifactClick }: { msg: Message; onArtifactClick: (a: Artifact) => void }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', gap: '12px',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '20px', animation: 'fadeUp 0.2s ease'
    }}>
      {!isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #f97316, #c2410c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Bebas Neue', fontSize: '14px', color: 'white',
          marginTop: '2px', boxShadow: '0 0 0 3px #1a0e0044'
        }}>V</div>
      )}
      <div style={{ maxWidth: isUser ? '65%' : '75%' }}>
        {!isUser && (
          <div style={{
            fontSize: '11px', fontFamily: 'IBM Plex Mono',
            color: '#f97316', marginBottom: '6px', letterSpacing: '0.5px'
          }}>VULCAN AGENT</div>
        )}
        <div style={{
          background: isUser ? '#1e1e1e' : '#141414',
          border: `1px solid ${isUser ? '#2a2a2a' : '#1e1e1e'}`,
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: '12px 16px', fontSize: '14px', lineHeight: '1.75',
          color: '#e8e8e8', whiteSpace: 'pre-wrap'
        }}>
          {msg.image && (
            <img src={msg.image} alt="uploaded" style={{
              maxWidth: '100%', borderRadius: '8px', marginBottom: '10px',
              display: 'block', border: '1px solid #2a2a2a'
            }} />
          )}
          {msg.content}
        </div>
        {msg.artifacts?.map((a, i) => (
          <ArtifactChip key={i} artifact={a} onClick={() => onArtifactClick(a)} />
        ))}
      </div>
      {isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: '#1e1e1e', border: '1px solid #2a2a2a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', marginTop: '18px'
        }}>👤</div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-start' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #f97316, #c2410c)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Bebas Neue', fontSize: '14px', color: 'white'
      }}>V</div>
      <div style={{ paddingTop: '18px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: '#f97316', marginBottom: '6px' }}>VULCAN AGENT</div>
        <div style={{
          background: '#141414', border: '1px solid #1e1e1e',
          borderRadius: '4px 16px 16px 16px', padding: '14px 18px',
          display: 'flex', gap: '6px', alignItems: 'center'
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#f97316',
              animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hey — I'm your Vulcan OmniPro 220 expert. Ask me anything about setup, settings, wiring, or troubleshooting. I can draw diagrams and build interactive tools when words aren't enough."
  }])
  const [input, setInput] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? input
    if (!text.trim() && !image) return

    const userMsg: Message = { role: 'user', content: text, image: imagePreview || undefined }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setImage(null)
    setImagePreview(null)
    setLoading(true)

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const formData = new FormData()
      formData.append('messages', JSON.stringify(apiMessages))
      if (image) formData.append('image', image)

      const res = await axios.post(`${API}/chat`, formData)
      const { text: resText, artifacts } = res.data

      setMessages(prev => [...prev, { role: 'assistant', content: resText, artifacts: artifacts || [] }])

      if (artifacts?.length > 0) setActiveArtifact(artifacts[0])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Make sure the backend is running on port 8000.' }])
    } finally {
      setLoading(false)
    }
  }

  const hasStarted = messages.length > 1

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn { from { transform:translateX(30px); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes pulse { 0%,80%,100% { transform:scale(0.7); opacity:0.4 } 40% { transform:scale(1); opacity:1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #e8e8e8; font-family: 'IBM Plex Sans', sans-serif; height: 100vh; overflow: hidden; }
        #root { height: 100vh; display: flex; flex-direction: column; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #222; }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid #1a1a1a', padding: '0 24px',
        height: '56px', display: 'flex', alignItems: 'center', gap: '16px',
        background: '#0a0a0a', flexShrink: 0, position: 'relative', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #c2410c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Bebas Neue', fontSize: '13px', color: 'white'
          }}>V</div>
          <div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '18px', letterSpacing: '2px', color: '#f97316', lineHeight: 1 }}>
              VULCAN OMNIPRO 220
            </div>
            <div style={{ fontSize: '10px', color: '#444', fontFamily: 'IBM Plex Mono', letterSpacing: '0.5px' }}>
              TECHNICAL SUPPORT AGENT
            </div>
          </div>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#1a1a1a' }} />

        <div style={{ display: 'flex', gap: '6px' }}>
          {['MIG', 'FLUX-CORE', 'TIG', 'STICK'].map(m => (
            <div key={m} style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
              fontFamily: 'IBM Plex Mono', color: '#555', border: '1px solid #1e1e1e'
            }}>{m}</div>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e88' }} />
          <span style={{ fontSize: '11px', color: '#444', fontFamily: 'IBM Plex Mono' }}>ONLINE</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main chat area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          marginRight: activeArtifact ? '520px' : '0', transition: 'margin 0.25s ease'
        }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 0' }}>

            {/* Welcome state */}
            {!hasStarted && (
              <div style={{ marginBottom: '32px', animation: 'fadeUp 0.4s ease' }}>
                <div style={{
                  background: '#111', border: '1px solid #1e1e1e',
                  borderRadius: '12px', padding: '20px 24px', marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: '#f97316', marginBottom: '8px' }}>QUICK QUESTIONS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {SUGGESTED.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s)} style={{
                        background: '#0e0e0e', border: '1px solid #1e1e1e',
                        borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                        color: '#aaa', fontSize: '13px', fontFamily: 'IBM Plex Sans',
                        textAlign: 'left', lineHeight: 1.4, transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#f9731644'; e.currentTarget.style.color = '#e8e8e8' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#aaa' }}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onArtifactClick={setActiveArtifact} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} style={{ height: '28px' }} />
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div style={{ padding: '0 28px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={imagePreview} alt="preview" style={{
                height: '56px', borderRadius: '6px', border: '1px solid #2a2a2a'
              }} />
              <button onClick={() => { setImage(null); setImagePreview(null) }} style={{
                background: 'none', border: '1px solid #2a2a2a', borderRadius: '50%',
                color: '#666', cursor: 'pointer', width: '22px', height: '22px', fontSize: '14px'
              }}>×</button>
            </div>
          )}

          {/* Input bar */}
          <div style={{
            padding: '16px 28px 20px', borderTop: '1px solid #1a1a1a',
            background: '#0a0a0a', flexShrink: 0
          }}>
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: '12px', padding: '6px 6px 6px 14px',
              transition: 'border-color 0.15s'
            }}
            onFocus={() => {}}
            >
              <input
                ref={fileRef} type="file" accept="image/*"
                onChange={handleImageChange} style={{ display: 'none' }}
              />
              <button onClick={() => fileRef.current?.click()} style={{
                background: 'none', border: 'none', color: '#444',
                cursor: 'pointer', fontSize: '16px', padding: '4px',
                transition: 'color 0.15s', flexShrink: 0
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.color = '#444'}
              title="Attach image">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 12l4-4 3 3 2-2 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="6" cy="6" r="1.2" fill="currentColor"/>
                </svg>
              </button>

              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask anything about the Vulcan OmniPro 220..."
                style={{
                  flex: 1, background: 'none', border: 'none',
                  color: '#e8e8e8', fontSize: '14px', fontFamily: 'IBM Plex Sans',
                  padding: '6px 0'
                }}
              />

              <button onClick={() => sendMessage()} disabled={loading} style={{
                background: loading ? '#7c3910' : '#f97316',
                border: 'none', borderRadius: '8px', color: 'white',
                padding: '8px 18px', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Bebas Neue', fontSize: '15px', letterSpacing: '1px',
                flexShrink: 0, transition: 'background 0.2s', display: 'flex',
                alignItems: 'center', gap: '6px'
              }}>
                {loading ? (
                  <div style={{ width: '14px', height: '14px', border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                SEND
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#333', fontFamily: 'IBM Plex Mono', marginTop: '8px', textAlign: 'center' }}>
              120V / 240V · MIG · FLUX-CORE · TIG · STICK · attach a photo of your weld for diagnosis
            </div>
          </div>
        </div>

        {/* Artifact panel */}
        {activeArtifact && (
          <ArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
        )}
      </div>
    </>
  )
}