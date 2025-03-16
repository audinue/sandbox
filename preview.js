importScripts('https://unpkg.com/idb-keyval@6.2.1/dist/umd.js')
importScripts('https://unpkg.com/marked@15.0.7/marked.min.js')
importScripts('https://unpkg.com/marked-highlight@2.2.1/lib/index.umd.js')
importScripts(
  'https://unpkg.com/@highlightjs/cdn-assets@11.11.1/highlight.min.js'
)
importScripts('https://unpkg.com/@babel/standalone@7.26.10/babel.min.js')

marked.use({
  gfm: true,
  breaks: true,
  silent: true
})

marked.use(
  markedHighlight.markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight (code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

const cdn = [
  'esm.sh',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'picsum.photos',
  'unpkg.com'
]

const mime = {
  html: 'text/html',
  md: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/javascript',
  tsx: 'text/javascript',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif'
}

const getMarkdown = content => {
  return `<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="https://unpkg.com/github-markdown-css@5.8.1/github-markdown.css">
    <link rel="stylesheet" href="https://unpkg.com/@highlightjs/cdn-assets@11.11.1/styles/github.min.css">
    <style>
      .markdown-body {
        box-sizing: border-box;
        min-width: 200px;
        max-width: 980px;
        margin: 0 auto;
        padding: 45px;
      }
      .markdown-body pre {
        padding: 0;
      }
      @media (max-width: 767px) {
        .markdown-body {
          padding: 15px;
        }
      }
    </style>
  </head>
  <body class="markdown-body">
    ${marked.parse(content)}
  </body>
</html>
`
}

const transform = ['jsx', 'ts', 'tsx']

Babel.registerPlugin('transform-esm-sh', () => {
  return {
    visitor: {
      ImportDeclaration (path) {
        const source = path.get('source')
        const value = source.node.value
        if (
          value.startsWith('.') ||
          value.startsWith('/') ||
          value.startsWith('http://') ||
          value.startsWith('https://')
        ) {
          return
        }
        path.get('source').replaceWithSourceString(`'https://esm.sh/${value}'`)
      }
    }
  }
})

const getTransformed = async (url, content) => {
  return Babel.transform(content, {
    filename: url,
    sourceFileName: url,
    sourceMaps: 'inline',
    presets: [
      'typescript',
      'react',
      [
        'env',
        {
          targets: {
            esmodules: true
          },
          modules: false
        }
      ]
    ],
    plugins: ['transform-esm-sh']
  }).code
}

const image = ['png', 'jpg', 'gif']

const getContent = async (projectName, fileName) => {
  const { projects } = await idbKeyval.get('sandbox')
  const project = projects.find(project => project.name === projectName)
  if (project) {
    const file = project.files.find(file => file.name === fileName)
    if (file) {
      const ext = fileName.match?.(/\.(.+?)$/)?.[1] ?? ''
      const headers = mime[ext] ? { 'Content-Type': mime[ext] } : {}
      const content =
        ext === 'md'
          ? getMarkdown(file.content)
          : transform.includes(ext)
          ? await getTransformed(
              `/preview/${projectName}/${fileName}`,
              file.content
            )
          : image.includes(ext)
          ? await (await fetch(file.content)).blob()
          : file.content
      return new Response(content, {
        headers
      })
    }
  }
  return Response.error()
}

const getCache = async request => {
  const cache = await caches.open('cdn')
  const previous = await cache.match(request)
  if (previous) {
    return previous
  }
  const next = await fetch(request)
  cache.put(request, next.clone())
  return next
}

addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (cdn.includes(url.hostname)) {
    e.respondWith(getCache(e.request))
  } else {
    const match = url.pathname.match(/^\/sandbox\/preview\/(.+?)\/(.+?)$/)
    if (match) {
      e.respondWith(getContent(match[1], match[2]))
    }
  }
})
