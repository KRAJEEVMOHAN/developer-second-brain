import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'http://localhost:3000/api/v1'

function App() {
  const [view, setView] = useState<'dashboard' | 'chat'>('dashboard')
  const [showImportModal, setShowImportModal] = useState(false)
  const [repos, setRepos] = useState<any[]>([])
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [newRepoBranch, setNewRepoBranch] = useState('main')
  
  const [activeRepo, setActiveRepo] = useState<any | null>(null)
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hello! I have indexed the repository. How can I help you understand the codebase today?', citations: [] as string[] }
  ])
  const [inputMessage, setInputMessage] = useState('')

  useEffect(() => {
    // Fetch repositories on mount
    fetch(`${API_URL}/repositories`)
      .then(res => res.json())
      .then(data => {
        const mappedRepos = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          desc: `Repository in ${r.language}`,
          status: r.status,
          lang: r.language === 'TypeScript' ? 'TS' : r.language === 'Go' ? 'GO' : 'JS',
          time: 'Recently',
          lines: 'N/A'
        }))
        setRepos(mappedRepos)
      })
      .catch(err => console.error('Failed to fetch repos:', err))
  }, [])

  const handleImport = () => {
    if (!newRepoUrl) return
    
    fetch(`${API_URL}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newRepoUrl, branch: newRepoBranch })
    })
      .then(res => res.json())
      .then(data => {
        const name = newRepoUrl.split('/').pop()?.replace('.git', '') || 'new-repo'
        const newRepo = {
          id: data.id,
          name: name,
          desc: `Imported from ${newRepoUrl}`,
          status: 'processing' as const,
          lang: '??',
          time: 'Just now',
          lines: '0'
        }
        setRepos([newRepo, ...repos])
        setNewRepoUrl('')
        setNewRepoBranch('main')
        setShowImportModal(false)
      })
      .catch(err => console.error('Failed to import repo:', err))
  }

  const handleSendMessage = () => {
    if (!inputMessage) return
    
    const userMsg = { role: 'user', content: inputMessage, citations: [] }
    setChatMessages(prev => [...prev, userMsg])
    const currentInput = inputMessage
    setInputMessage('')
    
    fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: currentInput, repo_id: activeRepo?.id })
    })
      .then(res => res.json())
      .then(data => {
        const aiMsg = { 
          role: 'ai', 
          content: data.response,
          citations: data.citations ? data.citations.map((c: any) => `${c.file}:${c.lines}`) : []
        }
        setChatMessages(prev => [...prev, aiMsg])
      })
      .catch(err => console.error('Failed to send message:', err))
  }

  const openChat = (repo: typeof repos[0]) => {
    setActiveRepo(repo)
    setView('chat')
    setChatMessages([
      { role: 'ai', content: `Hello! I have indexed the <strong>${repo.name}</strong> repository. How can I help you understand the codebase today?`, citations: [] }
    ])
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">Second Brain</span>
        </div>
        <nav className="nav-links">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <span className="icon">📁</span>
            Repositories
          </button>
          <button className="nav-item">
            <span className="icon">⚙️</span>
            Settings
          </button>
          <button className="nav-item">
            <span className="icon">❓</span>
            Help
          </button>
        </nav>
        <div className="user-profile">
          <div className="avatar">JD</div>
          <div className="user-info">
            <span className="user-name">John Doe</span>
            <span className="user-status">Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {view === 'dashboard' ? (
          <div className="dashboard-view">
            <header className="main-header">
              <div className="header-title">
                <h1>Your Repositories</h1>
                <p>Manage and interact with your indexed codebases.</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
                <span className="icon">+</span> Import Repository
              </button>
            </header>

            {/* Repository Grid */}
            <div className="repo-grid">
              {repos.map(repo => (
                <div key={repo.id} className="repo-card" onClick={() => openChat(repo)}>
                  <div className="repo-card-header">
                    <div className="repo-icon">{repo.lang}</div>
                    <span className={`status-badge status-${repo.status}`}>{repo.status.charAt(0).toUpperCase() + repo.status.slice(1)}</span>
                  </div>
                  <h3 className="repo-name">{repo.name}</h3>
                  <p className="repo-desc">{repo.desc}</p>
                  <div className="repo-meta">
                    <span>📅 {repo.time}</span>
                    <span>📊 {repo.lines} lines</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-view">
            <header className="main-header">
              <div className="header-title">
                <button className="btn btn-text" onClick={() => setView('dashboard')}>← Back</button>
                <h1>{activeRepo?.name}</h1>
              </div>
              <div className="header-actions">
                <span className={`status-badge status-${activeRepo?.status}`}>{activeRepo?.status.charAt(0).toUpperCase() + activeRepo?.status!.slice(1)}</span>
              </div>
            </header>

            <div className="chat-layout">
              {/* Left Column - File Explorer */}
              <div className="file-explorer">
                <h3>Files</h3>
                <div className="file-tree">
                  <div className="tree-item folder">📁 apps</div>
                  <div className="tree-item folder nested">📁 frontend</div>
                  <div className="tree-item file nested-2">📄 App.tsx</div>
                  <div className="tree-item file nested-2">📄 index.css</div>
                  <div className="tree-item folder">📁 docs</div>
                  <div className="tree-item file nested">📄 UI_SPEC.md</div>
                </div>
              </div>

              {/* Center Column - Chat Workspace */}
              <div className="chat-workspace">
                <div className="message-list">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`message message-${msg.role}`}>
                      <p dangerouslySetInnerHTML={{ __html: msg.content }}></p>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="citations">
                          <span>Citations:</span>
                          {msg.citations.map((cit, cIdx) => (
                            <code key={cIdx} className="citation-tag">{cit}</code>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="chat-input-area">
                  <textarea 
                    placeholder="Ask a question about this repository..." 
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  ></textarea>
                  <button className="btn btn-primary" onClick={handleSendMessage}>Send</button>
                </div>
              </div>

              {/* Right Column - Context & Citations */}
              <div className="context-sidebar">
                <h3>Context</h3>
                <div className="context-snippets">
                  {chatMessages.some(m => m.citations && m.citations.length > 0) ? (
                    <div className="snippet-card">
                      <div className="snippet-header">
                        <span>docs/design/UI_SPEC.md</span>
                      </div>
                      <pre><code>{`14: ### 3.1 Dashboard (Repository List)
15: The landing page after authentication.`}</code></pre>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No citations for the current message.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Import Repository</h2>
            <div className="form-group">
              <label>Git URL</label>
              <input 
                type="text" 
                placeholder="https://github.com/user/repo" 
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Branch</label>
              <select value={newRepoBranch} onChange={(e) => setNewRepoBranch(e.target.value)}>
                <option value="main">main</option>
                <option value="develop">develop</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport}>Start Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
