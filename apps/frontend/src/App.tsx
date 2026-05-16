import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'http://localhost:3000/api/v1'

interface TreeNode {
  name: string;
  isFolder: boolean;
  children: TreeNode[];
  fullPath?: string;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  paths.forEach(p => {
    const parts = p.split(/[\\\/]/);
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      let existing = currentLevel.find(item => item.name === part);

      if (!existing) {
        existing = {
          name: part,
          isFolder: !isLast,
          children: [],
          fullPath: isLast ? p : undefined
        };
        currentLevel.push(existing);
      }

      currentLevel = existing.children;
    });
  });

  return root;
}

function TreeNodeView({ node, level = 0, onFileClick }: { node: TreeNode, level?: number, onFileClick: (path: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ marginLeft: level > 0 ? '12px' : '0' }}>
      <div
        className={`tree-item ${node.isFolder ? 'folder' : 'file'}`}
        onClick={() => {
          if (node.isFolder) {
            setIsOpen(!isOpen);
          } else if (node.fullPath) {
            onFileClick(node.fullPath);
          }
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 0',
          fontSize: '0.9rem',
          color: 'var(--text-primary)'
        }}
      >
        {node.isFolder ? (isOpen ? '📂' : '📁') : '📄'}
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {node.isFolder && isOpen && node.children.map((child, idx) => (
        <TreeNodeView key={idx} node={child} level={level + 1} onFileClick={onFileClick} />
      ))}
    </div>
  );
}

function App() {
  const [view, setView] = useState<'dashboard' | 'chat'>('dashboard')
  const [showImportModal, setShowImportModal] = useState(false)
  const [repos, setRepos] = useState<any[]>([])
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [newRepoBranch, setNewRepoBranch] = useState('main')

  const [activeRepo, setActiveRepo] = useState<any | null>(null)
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hello! I have indexed the repository. How can I help you understand the codebase today?', citations: [] as any[] }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [symbols, setSymbols] = useState<any[]>([])
  const [relationships, setRelationships] = useState<any[]>([])
  const [sidebarTab, setSidebarTab] = useState<'context' | 'relationships' | 'quality'>('context')
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(false)

  const handleFileClick = (path: string) => {
    setSelectedFilePath(path);
    fetch(`${API_URL}/repositories/${activeRepo?.id}/file?path=${encodeURIComponent(path)}`)
      .then(res => res.json())
      .then(data => setSelectedFileContent(data.content))
      .catch(err => console.error('Failed to fetch file content:', err))
  }

  const generateMermaid = () => {
    let str = 'graph TD\n';
    relationships.forEach(rel => {
      const source = rel.source_file.split(/[\\\/]/).pop() || '';
      const target = rel.target_file.split(/[\\\/]/).pop() || '';
      str += `  ${source.replace(/[^a-zA-Z0-9]/g, '_')}["${source}"] -->|${rel.symbol_name}| ${target.replace(/[^a-zA-Z0-9]/g, '_')}["${target}"]\n`;
    });
    return str;
  };

  useEffect(() => {
    if (showGraph && relationships.length > 0 && (window as any).mermaid) {
      const mermaidString = generateMermaid();
      const element = document.getElementById('mermaid-graph');
      if (element) {
        try {
          (window as any).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          (window as any).mermaid.render('mermaid-svg', mermaidString).then((result: any) => {
            element.innerHTML = result.svg;
          }).catch((err: any) => {
            console.error('Mermaid render failed:', err);
            element.innerHTML = `<p style="color: red;">Failed to render graph: ${err.message}</p>`;
          });
        } catch (err) {
          console.error('Mermaid init failed:', err);
        }
      }
    }
  }, [showGraph, relationships]);

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
          citations: data.citations || []
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

    // Fetch files for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/files`)
      .then(res => res.json())
      .then(data => {
        console.log('Fetched files for repo:', data);
        setFiles(data);
      })
      .catch(err => console.error('Failed to fetch files:', err))

    // Fetch symbols for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/symbols`)
      .then(res => res.json())
      .then(data => setSymbols(data))
      .catch(err => console.error('Failed to fetch symbols:', err))

    // Fetch relationships for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/relationships`)
      .then(res => res.json())
      .then(data => setRelationships(data))
      .catch(err => console.error('Failed to fetch relationships:', err))
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
              {/* Left Column - File Explorer & Symbols */}
              <div className="file-explorer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h3>Files</h3>
                  <div className="file-tree" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                    {files.length > 0 ? (
                      buildTree(files).map((node, idx) => (
                        <TreeNodeView key={idx} node={node} onFileClick={handleFileClick} />
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No files indexed.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3>Symbols</h3>
                  <div className="symbols-list" style={{ maxHeight: '40vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {symbols.length > 0 ? (
                      symbols.map((sym, idx) => (
                        <div key={idx} className="tree-item file" title={`${sym.name} in ${sym.file_path}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {sym.kind === 'class' ? '🔷' : sym.kind === 'function' ? 'λ' : '📦'}
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {sym.name}
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '4px' }}>
                              ({sym.length} lines{sym.parameter_count !== null && sym.parameter_count !== undefined ? `, ${sym.parameter_count} params` : ''})
                            </span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No symbols found.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Column - Chat Workspace or File Viewer */}
              <div className="chat-workspace">
                {showGraph ? (
                  <div className="graph-viewer" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', height: '100%', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Repository Code Graph</h3>
                      <button className="btn btn-text" onClick={() => setShowGraph(false)}>Close</button>
                    </div>
                    <div id="mermaid-graph" style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '4px', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {relationships.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No relationships to display.</p>}
                    </div>
                  </div>
                ) : selectedFileContent ? (
                  <div className="file-viewer" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', height: '100%', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>{selectedFilePath}</h3>
                      <button className="btn btn-text" onClick={() => setSelectedFileContent(null)}>Close</button>
                    </div>
                    <pre className="language-typescript" style={{ margin: 0, borderRadius: '4px', padding: '1rem', backgroundColor: 'var(--bg-primary)', whiteSpace: 'pre-wrap' }}>
                      <code style={{ whiteSpace: 'pre-wrap' }}>{selectedFileContent}</code>
                    </pre>
                  </div>
                ) : (
                  <>
                    <div className="message-list">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`message message-${msg.role}`}>
                          <p dangerouslySetInnerHTML={{ __html: msg.content }}></p>
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="citations">
                              <span>Citations:</span>
                              {msg.citations.map((cit, cIdx) => (
                                <code key={cIdx} className="citation-tag">{cit.file}:{cit.lines}</code>
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
                  </>
                )}
              </div>

              {/* Right Column - Context & Graph */}
              <div className="context-sidebar">
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                  <button
                    className={`btn btn-text`}
                    onClick={() => setSidebarTab('context')}
                    style={{ color: sidebarTab === 'context' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: sidebarTab === 'context' ? 'bold' : 'normal', padding: '0.5rem' }}
                  >
                    Context
                  </button>
                  <button
                    className={`btn btn-text`}
                    onClick={() => setSidebarTab('relationships')}
                    style={{ color: sidebarTab === 'relationships' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: sidebarTab === 'relationships' ? 'bold' : 'normal', padding: '0.5rem' }}
                  >
                    Graph
                  </button>
                  <button
                    className={`btn btn-text`}
                    onClick={() => setSidebarTab('quality')}
                    style={{ color: sidebarTab === 'quality' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: sidebarTab === 'quality' ? 'bold' : 'normal', padding: '0.5rem' }}
                  >
                    Quality
                  </button>
                </div>

                {sidebarTab === 'context' ? (
                  <div className="context-snippets">
                    {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].citations?.length > 0 ? (
                      (chatMessages[chatMessages.length - 1].citations as any[]).map((cit: any, idx: number) => (
                        <div key={idx} className="snippet-card">
                          <div className="snippet-header">
                            <span>{cit.file}:{cit.lines}</span>
                          </div>
                          <pre><code>{cit.content}</code></pre>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No citations for the current message.</p>
                    )}
                  </div>
                ) : sidebarTab === 'relationships' ? (
                  <div className="relationships-list">
                    <h3>Code Graph</h3>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginBottom: '1rem' }}
                      onClick={() => setShowGraph(true)}
                    >
                      View Visual Graph
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                      {relationships.length > 0 ? (
                        relationships.map((rel, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{rel.symbol_name}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>defined in</span>
                            </div>
                            <div style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '4px' }}>{rel.target_file}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              Used in: <span style={{ color: 'var(--text-primary)' }}>{rel.source_file}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No relationships found.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="quality-report">
                    <h3>Code Quality</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                      
                      <div>
                        <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>⚠️ Long Functions (&gt; 50 lines)</h4>
                        {symbols.filter(s => s.kind === 'function' && s.length > 50).length > 0 ? (
                          symbols.filter(s => s.kind === 'function' && s.length > 50).map((sym, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '0.25rem' }}>
                              <strong>{sym.name}</strong> ({sym.length} lines)
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>in {sym.file_path.split(/[\\\/]/).pop()}</div>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>None found! Great job.</p>
                        )}
                      </div>

                      <div>
                        <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>⚠️ Complex Signatures (&gt; 3 params)</h4>
                        {symbols.filter(s => s.kind === 'function' && s.parameter_count > 3).length > 0 ? (
                          symbols.filter(s => s.kind === 'function' && s.parameter_count > 3).map((sym, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '0.25rem' }}>
                              <strong>{sym.name}</strong> ({sym.parameter_count} params)
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>in {sym.file_path.split(/[\\\/]/).pop()}</div>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>None found! Great job.</p>
                        )}
                      </div>

                    </div>
                  </div>
                )}
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
