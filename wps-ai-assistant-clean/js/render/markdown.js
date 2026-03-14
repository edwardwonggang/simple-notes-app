(function registerMarkdown(app) {
    const host = app.core.host

    function textToken(text) {
        return { type: "text", text }
    }

    function parseInline(text) {
        const source = String(text || "")
        const tokens = []
        let cursor = 0

        function push(fragment) {
            if (!fragment) {
                return
            }
            const last = tokens[tokens.length - 1]
            if (last && last.type === "text") {
                last.text += fragment
            } else {
                tokens.push(textToken(fragment))
            }
        }

        while (cursor < source.length) {
            const strongMatch = source.slice(cursor).match(/^(\*\*|__)(.+?)\1/)
            if (strongMatch) {
                tokens.push({ type: "strong", children: parseInline(strongMatch[2]) })
                cursor += strongMatch[0].length
                continue
            }

            const emMatch = source.slice(cursor).match(/^(\*|_)(.+?)\1/)
            if (emMatch) {
                tokens.push({ type: "em", children: parseInline(emMatch[2]) })
                cursor += emMatch[0].length
                continue
            }

            const codeMatch = source.slice(cursor).match(/^`([^`]+)`/)
            if (codeMatch) {
                tokens.push({ type: "code", text: codeMatch[1] })
                cursor += codeMatch[0].length
                continue
            }

            const linkMatch = source.slice(cursor).match(/^\[([^\]]+)\]\(([^)]+)\)/)
            if (linkMatch) {
                tokens.push({ type: "link", href: linkMatch[2], children: parseInline(linkMatch[1]) })
                cursor += linkMatch[0].length
                continue
            }

            const nextSpecial = source.slice(cursor + 1).search(/(\*\*|__|\*|_|`|\[)/)
            if (nextSpecial === -1) {
                push(source.slice(cursor))
                break
            }

            push(source.slice(cursor, cursor + nextSpecial + 1))
            cursor += nextSpecial + 1
        }

        return tokens
    }

    function flattenInline(tokens, style, output) {
        const active = style || {}
        const result = output || { text: "", spans: [] }

        ;(tokens || []).forEach((token) => {
            if (!token) {
                return
            }

            if (token.type === "text") {
                const start = result.text.length
                result.text += token.text || ""
                if (active.bold || active.italic || active.link || active.code) {
                    result.spans.push({
                        start,
                        end: result.text.length,
                        bold: Boolean(active.bold),
                        italic: Boolean(active.italic),
                        link: Boolean(active.link),
                        code: Boolean(active.code)
                    })
                }
                return
            }

            if (token.type === "code") {
                const start = result.text.length
                result.text += token.text || ""
                result.spans.push({
                    start,
                    end: result.text.length,
                    code: true
                })
                return
            }

            flattenInline(token.children || [], {
                bold: active.bold || token.type === "strong",
                italic: active.italic || token.type === "em",
                link: active.link || token.type === "link",
                code: active.code
            }, result)
        })

        return result
    }

    function parseBlocks(markdownText) {
        const lines = host.normalizeLineBreaks(markdownText || "").split("\n")
        const blocks = []
        let index = 0
        let paragraph = []

        function flushParagraph() {
            if (!paragraph.length) {
                return
            }
            const text = paragraph.join(" ").replace(/\s+/g, " ").trim()
            if (text) {
                blocks.push({
                    type: "paragraph",
                    tokens: parseInline(text)
                })
            }
            paragraph = []
        }

        while (index < lines.length) {
            const rawLine = lines[index]
            const line = rawLine.trim()

            if (!line) {
                flushParagraph()
                index += 1
                continue
            }

            if (/^```/.test(line)) {
                flushParagraph()
                index += 1
                const codeLines = []
                while (index < lines.length && !/^```/.test(lines[index].trim())) {
                    codeLines.push(lines[index])
                    index += 1
                }
                if (index < lines.length) {
                    index += 1
                }
                blocks.push({
                    type: "code",
                    text: codeLines.join("\n")
                })
                continue
            }

            const heading = line.match(/^(#{1,6})\s+(.+)$/)
            if (heading) {
                flushParagraph()
                blocks.push({
                    type: "heading",
                    level: heading[1].length,
                    tokens: parseInline(heading[2])
                })
                index += 1
                continue
            }

            if (/^>\s?/.test(line)) {
                flushParagraph()
                const items = []
                while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
                    items.push(lines[index].trim().replace(/^>\s?/, ""))
                    index += 1
                }
                blocks.push({
                    type: "quote",
                    tokens: parseInline(items.join(" "))
                })
                continue
            }

            if (/^([-*_])(\s*\1){2,}\s*$/.test(line)) {
                flushParagraph()
                blocks.push({ type: "rule" })
                index += 1
                continue
            }

            const list = rawLine.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/)
            if (list) {
                flushParagraph()
                const ordered = /\d+\./.test(list[2])
                const items = []
                while (index < lines.length) {
                    const current = lines[index].match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/)
                    if (!current || /\d+\./.test(current[2]) !== ordered) {
                        break
                    }
                    items.push({
                        level: Math.floor((current[1] || "").length / 2),
                        tokens: parseInline(current[3])
                    })
                    index += 1
                }
                blocks.push({
                    type: "list",
                    ordered,
                    items
                })
                continue
            }

            paragraph.push(line)
            index += 1
        }

        flushParagraph()
        return blocks
    }

    app.render.markdown = {
        parseInline,
        flattenInline,
        parseBlocks
    }
})(window.WpsAiAssistantClean)

