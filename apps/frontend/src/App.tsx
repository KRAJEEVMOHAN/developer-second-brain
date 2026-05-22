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

function renderMarkdown(text: string) {
  if (!text) return null;

  // Split by code blocks: ```typescript ... ```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
      const code = match ? match[2] : part.slice(3, -3);

      return (
        <pre 
          key={index} 
          style={{ 
            backgroundColor: 'var(--bg-primary)', 
            padding: '1rem', 
            borderRadius: '6px', 
            border: '1px solid var(--border-color)', 
            overflowX: 'auto',
            margin: '0.75rem 0',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem'
          }}
        >
          <code style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{code}</code>
        </pre>
      );
    } else {
      const lines = part.split('\n');
      return lines.map((line, lIdx) => {
        if (line.startsWith('###')) {
          return <h3 key={`${index}-${lIdx}`} style={{ color: 'var(--accent)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>{line.replace(/^###+\s*/, '')}</h3>;
        }
        if (line.startsWith('####')) {
          return <h4 key={`${index}-${lIdx}`} style={{ color: 'var(--text-primary)', marginTop: '1rem', marginBottom: '0.5rem' }}>{line.replace(/^####+\s*/, '')}</h4>;
        }
        if (line.startsWith('#####')) {
          return <h5 key={`${index}-${lIdx}`} style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginTop: '0.75rem', marginBottom: '0.25rem' }}>{line.replace(/^#####+\s*/, '')}</h5>;
        }
        const boldRegex = /\*\*([^*]+)\*\*/g;
        if (boldRegex.test(line)) {
          const elements = [];
          let lastIdx = 0;
          boldRegex.lastIndex = 0;
          let match;
          while ((match = boldRegex.exec(line)) !== null) {
            elements.push(line.substring(lastIdx, match.index));
            elements.push(<strong key={match.index} style={{ color: 'var(--text-primary)' }}>{match[1]}</strong>);
            lastIdx = boldRegex.lastIndex;
          }
          elements.push(line.substring(lastIdx));
          return <p key={`${index}-${lIdx}`} style={{ margin: '0.35rem 0', lineHeight: '1.5' }}>{elements}</p>;
        }

        return line.trim() ? (
          <p key={`${index}-${lIdx}`} style={{ margin: '0.35rem 0', lineHeight: '1.5' }}>{line}</p>
        ) : (
          <div key={`${index}-${lIdx}`} style={{ height: '0.5rem' }}></div>
        );
      });
    }
  });
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
  const [sidebarTab, setSidebarTab] = useState<'context' | 'relationships' | 'quality' | 'memory'>('context')
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(false)
  const [circularDependencies, setCircularDependencies] = useState<any[]>([])
  const [deadCode, setDeadCode] = useState<{ unusedFiles: string[], unusedSymbols: any[] } | null>(null)
  const [isLoadingRefactor, setIsLoadingRefactor] = useState(false)
  const [activeRefactorSuggestion, setActiveRefactorSuggestion] = useState<string | null>(null)
  const [refactoringCycleIndex, setRefactoringCycleIndex] = useState<number | null>(null)

  const [memories, setMemories] = useState<any[]>([])
  const [searchMemoryQuery, setSearchMemoryQuery] = useState('')
  const [newMemoryTitle, setNewMemoryTitle] = useState('')
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryType, setNewMemoryType] = useState('decision')
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false)

  const handleFileClick = (path: string) => {
    setSelectedFilePath(path);
    fetch(`${API_URL}/repositories/${activeRepo?.id}/file?path=${encodeURIComponent(path)}`)
      .then(res => res.json())
      .then(data => setSelectedFileContent(data.content))
      .catch(err => console.error('Failed to fetch file content:', err))
  }

  const handleSuggestRefactor = (cyclePath: string[], index: number) => {
    setIsLoadingRefactor(true)
    setRefactoringCycleIndex(index)
    setActiveRefactorSuggestion("")

    fetch(`${API_URL}/repositories/${activeRepo?.id}/circular-dependencies/refactor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cyclePath })
    })
      .then(res => res.json())
      .then(data => {
        setActiveRefactorSuggestion(data.suggestion)
      })
      .catch(err => {
        console.error('Failed to get refactoring suggestions:', err)
        setActiveRefactorSuggestion("Failed to load suggestions. Please check if backend is running.")
      })
      .finally(() => {
        setIsLoadingRefactor(false)
      })
  }

  const handleSearchMemory = (query: string, repoId = activeRepo?.id) => {
    setSearchMemoryQuery(query)
    if (!repoId) return
    const url = query
      ? `${API_URL}/repositories/${repoId}/memories?q=${encodeURIComponent(query)}`
      : `${API_URL}/repositories/${repoId}/memories`
    fetch(url)
      .then(res => res.json())
      .then(data => setMemories(data))
      .catch(err => console.error('Failed to search memories:', err))
  }

  const handleCreateMemory = () => {
    if (!newMemoryTitle || !newMemoryContent || !newMemoryType || !activeRepo) return

    fetch(`${API_URL}/repositories/${activeRepo.id}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newMemoryTitle,
        content: newMemoryContent,
        type: newMemoryType
      })
    })
      .then(res => res.json())
      .then(() => {
        handleSearchMemory(searchMemoryQuery)
        setNewMemoryTitle('')
        setNewMemoryContent('')
        setNewMemoryType('decision')
        setShowAddMemoryModal(false)
      })
      .catch(err => console.error('Failed to create memory:', err))
  }

  const handleDeleteMemory = (memoryId: string) => {
    if (!activeRepo) return

    fetch(`${API_URL}/repositories/${activeRepo.id}/memories/${memoryId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(() => {
        handleSearchMemory(searchMemoryQuery)
      })
      .catch(err => console.error('Failed to delete memory:', err))
  }

  const generateMermaid = () => {
    let str = 'graph TD\n';
    relationships.forEach(rel => {
      const source = rel.source_file.split(/[\\\/]/).pop() || '';
      const target = rel.target_file.split(/[\\\/]/).pop() || '';
      str += `  ${source.replace(/[^a-zA-Z0-9]/g, '_')}["${source}"] -->|${rel.symbol_name}| ${target.replace(/[^a-zA-Z0-9]/g, '_')}["${target}"]\n`;
    });

    // Highlight circular dependency nodes in red
    const cycleNodes = new Set<string>();
    if (circularDependencies && circularDependencies.length > 0) {
      circularDependencies.forEach(cycle => {
        if (cycle.path) {
          cycle.path.forEach((filePath: string) => {
            const baseName = filePath.split(/[\\\/]/).pop() || filePath;
            cycleNodes.add(baseName.replace(/[^a-zA-Z0-9]/g, '_'));
          });
        }
      });
    }

    if (cycleNodes.size > 0) {
      str += `  classDef cycleNode fill:#3f1f1f,stroke:#ef4444,stroke-width:2px,color:#fee2e2;\n`;
      str += `  class ${Array.from(cycleNodes).join(',')} cycleNode;\n`;
    }

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
  }, [showGraph, relationships, circularDependencies]);

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
    setCircularDependencies([])
    setDeadCode(null)
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

    // Fetch memories for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/memories`)
      .then(res => res.json())
      .then(data => setMemories(data))
      .catch(err => console.error('Failed to fetch memories:', err))

    // Fetch circular dependencies for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/circular-dependencies`)
      .then(res => res.json())
      .then(data => setCircularDependencies(data))
      .catch(err => console.error('Failed to fetch circular dependencies:', err))

    // Fetch dead code for the active repository
    fetch(`${API_URL}/repositories/${repo.id}/dead-code`)
      .then(res => res.json())
      .then(data => setDeadCode(data))
      .catch(err => console.error('Failed to fetch dead code:', err))
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
                  <button
                    className={`btn btn-text`}
                    onClick={() => setSidebarTab('memory')}
                    style={{ color: sidebarTab === 'memory' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: sidebarTab === 'memory' ? 'bold' : 'normal', padding: '0.5rem' }}
                  >
                    Memory
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
                ) : sidebarTab === 'quality' ? (
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

                      <div>
                        <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>🔄 Circular Dependencies</h4>
                        {circularDependencies && circularDependencies.length > 0 ? (
                          circularDependencies.map((cycle, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid #ef4444', marginBottom: '0.5rem', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>Cycle #{idx + 1}</span>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleSuggestRefactor(cycle.path, idx + 1)}
                                >
                                  💡 Refactor
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {cycle.path.map((filePath: string, fIdx: number) => {
                                  const baseName = filePath.split(/[\\\/]/).pop() || filePath;
                                  const isLast = fIdx === cycle.path.length - 1;
                                  const symbol = !isLast && cycle.symbols ? cycle.symbols[fIdx] : null;

                                  return (
                                    <div key={fIdx}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span 
                                          style={{ 
                                            color: 'var(--text-primary)', 
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                            textDecorationStyle: 'dotted'
                                          }} 
                                          onClick={() => handleFileClick(filePath)}
                                          title={`Click to view ${filePath}`}
                                        >
                                          {baseName}
                                        </span>
                                      </div>
                                      {!isLast && (
                                        <div style={{ paddingLeft: '12px', borderLeft: '2px dashed #ef4444', margin: '4px 0 4px 6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                          importing <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{symbol}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>None found! Great job.</p>
                        )}
                      </div>

                      <div>
                        <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>🗑️ Dead Code & Unused Symbols</h4>
                        {deadCode ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Unused Files */}
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Unused Files ({deadCode.unusedFiles.length})
                              </div>
                              {deadCode.unusedFiles.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {deadCode.unusedFiles.map((filePath, idx) => (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        fontSize: '0.85rem', 
                                        padding: '0.5rem', 
                                        backgroundColor: 'var(--bg-secondary)', 
                                        borderRadius: '4px', 
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        textDecorationStyle: 'dotted'
                                      }}
                                      onClick={() => handleFileClick(filePath)}
                                      title={`Click to view ${filePath}`}
                                    >
                                      {filePath}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No unused files found.</p>
                              )}
                            </div>

                            {/* Unused Symbols */}
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Unused Symbols ({deadCode.unusedSymbols.length})
                              </div>
                              {deadCode.unusedSymbols.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {deadCode.unusedSymbols.map((sym, idx) => (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        fontSize: '0.85rem', 
                                        padding: '0.5rem', 
                                        backgroundColor: 'var(--bg-secondary)', 
                                        borderRadius: '4px' 
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>{sym.name}</strong>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'capitalize' }}>{sym.kind}</span>
                                      </div>
                                      <div 
                                        style={{ 
                                          color: 'var(--accent)', 
                                          fontSize: '0.75rem', 
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textDecorationStyle: 'dotted',
                                          marginTop: '0.15rem'
                                        }}
                                        onClick={() => handleFileClick(sym.filePath)}
                                        title={`Click to view ${sym.filePath}`}
                                      >
                                        in {sym.filePath}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No unused symbols found.</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Analyzing dead code...</p>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="memory-tab">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Team Memory</h3>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => setShowAddMemoryModal(true)}
                      >
                        + Add
                      </button>
                    </div>

                    <div className="memory-search-bar">
                      <input
                        type="text"
                        placeholder="Search memories semantically..."
                        value={searchMemoryQuery}
                        onChange={(e) => handleSearchMemory(e.target.value)}
                      />
                    </div>

                    <div className="memories-container">
                      {memories.length > 0 ? (
                        memories.map((mem) => (
                          <div key={mem.id} className="memory-card">
                            <div className="memory-card-header">
                              <span className={`memory-badge badge-${mem.type}`}>
                                {mem.type}
                              </span>
                              <button 
                                className="btn-delete-memory"
                                onClick={() => handleDeleteMemory(mem.id)}
                                title="Delete Memory"
                              >
                                🗑️
                              </button>
                            </div>
                            <div className="memory-title">{mem.title}</div>
                            <div className="memory-content">{mem.content}</div>
                            <div className="memory-footer">
                              <span>📅 {new Date(mem.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                          No team memories stored yet.
                        </p>
                      )}
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

      {/* Add Memory Modal */}
      {showAddMemoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add Team Memory</h2>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Switched to Postgres"
                value={newMemoryTitle}
                onChange={(e) => setNewMemoryTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={newMemoryType} onChange={(e) => setNewMemoryType(e.target.value)}>
                <option value="decision">Decision</option>
                <option value="note">Note</option>
                <option value="migration">Migration</option>
                <option value="meeting">Meeting Summary</option>
              </select>
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea
                placeholder="Describe the decision, note, migration reason, or meeting summary..."
                rows={4}
                value={newMemoryContent}
                onChange={(e) => setNewMemoryContent(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '0.75rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              ></textarea>
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowAddMemoryModal(false);
                  setNewMemoryTitle('');
                  setNewMemoryContent('');
                  setNewMemoryType('decision');
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateMemory}>Save Memory</button>
            </div>
          </div>
        </div>
      )}

      {/* Refactor Suggestions Modal */}
      {(isLoadingRefactor || activeRefactorSuggestion !== null) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>💡 AI Refactoring Advice (Cycle #{refactoringCycleIndex})</h2>
              <button 
                className="btn btn-text" 
                style={{ fontSize: '1.25rem', padding: '0.25rem' }} 
                onClick={() => {
                  setActiveRefactorSuggestion(null)
                  setRefactoringCycleIndex(null)
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 0', color: 'var(--text-secondary)' }}>
              {isLoadingRefactor ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '1rem' }}>
                  <div className="spinner" style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid rgba(239, 68, 68, 0.1)',
                    borderTop: '4px solid #ef4444',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>Analyzing cycle and generating recommendations...</span>
                </div>
              ) : (
                <div className="markdown-body" style={{ textAlign: 'left' }}>
                  {renderMarkdown(activeRefactorSuggestion || "")}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setActiveRefactorSuggestion(null)
                  setRefactoringCycleIndex(null)
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
