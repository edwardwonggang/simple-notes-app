(function registerWpsRenderer(app) {
    const host = app.core.host
    const markdown = app.render.markdown

    function insertAt(position, text) {
        const content = String(text || "")
        if (!content) {
            return null
        }
        const range = host.getDocumentRange(position, position)
        if (!range) {
            return null
        }
        if (typeof range.InsertAfter === "function") {
            range.InsertAfter(content)
        } else {
            host.setRangeText(range, content)
        }
        return host.getDocumentRange(position, position + content.length)
    }

    function styleInline(baseStart, spans) {
        ;(spans || []).forEach((span) => {
            const range = host.getDocumentRange(baseStart + span.start, baseStart + span.end)
            if (!range) {
                return
            }
            if (span.bold) {
                try {
                    range.Bold = 1
                } catch (_error) {
                }
            }
            if (span.italic) {
                try {
                    range.Italic = 1
                } catch (_error) {
                }
            }
            if (span.link) {
                try {
                    range.Underline = 1
                } catch (_error) {
                }
            }
            if (span.code) {
                host.applyFont(range, (font) => {
                    font.Name = "Consolas"
                })
            }
        })
    }

    function styleHeading(range, level) {
        const sizes = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 11 }
        host.applyFont(range, (font) => {
            font.Bold = 1
            font.Size = sizes[level] || 12
        })
        host.applyParagraph(range, (paragraph) => {
            paragraph.SpaceAfter = level <= 2 ? 6 : 3
        })
    }

    function styleParagraph(range) {
        host.applyParagraph(range, (paragraph) => {
            paragraph.SpaceAfter = 0
        })
    }

    function styleQuote(range) {
        host.applyParagraph(range, (paragraph) => {
            paragraph.LeftIndent = 18
            paragraph.SpaceAfter = 0
        })
        try {
            range.Italic = 1
        } catch (_error) {
        }
    }

    function styleCodeBlock(range) {
        host.applyParagraph(range, (paragraph) => {
            paragraph.LeftIndent = 18
            paragraph.SpaceAfter = 0
        })
        host.applyFont(range, (font) => {
            font.Name = "Consolas"
        })
    }

    function renderTextBlock(cursor, inlineTokens, kind, level) {
        const flattened = markdown.flattenInline(inlineTokens)
        const text = flattened.text || ""
        insertAt(cursor, `${text}\n`)
        const textRange = host.getDocumentRange(cursor, cursor + text.length)
        if (textRange) {
            if (kind === "heading") {
                styleHeading(textRange, level)
            } else if (kind === "quote") {
                styleQuote(textRange)
            } else {
                styleParagraph(textRange)
            }
            styleInline(cursor, flattened.spans)
        }
        return cursor + text.length + 1
    }

    function renderList(cursor, block) {
        let next = cursor
        const ranges = []

        ;(block.items || []).forEach((item) => {
            const flattened = markdown.flattenInline(item.tokens)
            const text = flattened.text || ""
            insertAt(next, `${text}\n`)
            ranges.push({
                start: next,
                end: next + text.length,
                spans: flattened.spans,
                level: item.level || 0
            })
            next += text.length + 1
        })

        ranges.forEach((entry) => {
            const range = host.getDocumentRange(entry.start, entry.end)
            if (!range) {
                return
            }
            try {
                if (block.ordered) {
                    range.ListFormat.ApplyNumberDefault()
                } else {
                    range.ListFormat.ApplyBulletDefault()
                }
            } catch (_error) {
            }
            for (let step = 0; step < entry.level; step += 1) {
                try {
                    range.ListFormat.ListIndent()
                } catch (_error) {
                    break
                }
            }
            styleInline(entry.start, entry.spans)
        })

        return next
    }

    function renderRule(cursor) {
        const text = "────────"
        insertAt(cursor, `${text}\n`)
        const range = host.getDocumentRange(cursor, cursor + text.length)
        if (range) {
            host.applyFont(range, (font) => {
                font.Color = 8421504
            })
        }
        return cursor + text.length + 1
    }

    function renderCode(cursor, text) {
        const content = String(text || "")
        insertAt(cursor, `${content}\n`)
        const range = host.getDocumentRange(cursor, cursor + content.length)
        if (range) {
            styleCodeBlock(range)
        }
        return cursor + content.length + 1
    }

    function renderMarkdown(range, markdownText) {
        const duplicate = range && range.Duplicate ? range.Duplicate : range
        if (!duplicate) {
            throw new Error("当前没有可写入的文档位置，请先打开一个可编辑文档。")
        }

        const start = Number(duplicate.Start)
        const end = Number(duplicate.End)
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            throw new Error("无法定位写入范围。")
        }

        const target = host.getDocumentRange(start, end)
        if (!target) {
            throw new Error("无法获取写入范围。")
        }
        host.setRangeText(target, "")

        const blocks = markdown.parseBlocks(markdownText)
        let cursor = start

        blocks.forEach((block) => {
            if (!block) {
                return
            }
            if (block.type === "heading") {
                cursor = renderTextBlock(cursor, block.tokens, "heading", block.level)
                return
            }
            if (block.type === "paragraph") {
                cursor = renderTextBlock(cursor, block.tokens, "paragraph", 0)
                return
            }
            if (block.type === "quote") {
                cursor = renderTextBlock(cursor, block.tokens, "quote", 0)
                return
            }
            if (block.type === "list") {
                cursor = renderList(cursor, block)
                return
            }
            if (block.type === "rule") {
                cursor = renderRule(cursor)
                return
            }
            if (block.type === "code") {
                cursor = renderCode(cursor, block.text)
            }
        })

        return {
            start,
            end: cursor
        }
    }

    function createConversationWriter(promptText) {
        const writer = {
            closed: false,
            question: host.normalizeText(promptText),
            accumulated: "",
            start: 0,
            end: 0,
            timer: null,
            rendering: false,
            wroteContent: false
        }

        const header = `${host.getActiveDocument() && host.getActiveDocument().Content && host.normalizeText(host.getActiveDocument().Content.Text || "") ? "\n" : ""}【AI 对话】\n问题：${writer.question}\n回答：\n`
        host.appendVisibleText(header)
        const anchor = host.getDocumentEndRange()
        writer.start = anchor ? Number(anchor.Start) : 0
        writer.end = writer.start

        function redraw() {
            if (writer.rendering || writer.closed) {
                return
            }
            writer.rendering = true
            try {
                const range = host.getDocumentRange(writer.start, writer.end)
                if (!range) {
                    throw new Error("无法获取回复区域。")
                }
                const rendered = renderMarkdown(range, writer.accumulated)
                writer.end = rendered.end
                const tail = host.getDocumentRange(writer.end, writer.end)
                host.scrollIntoView(tail || range)
            } finally {
                writer.rendering = false
            }
        }

        function scheduleRedraw() {
            if (writer.timer || writer.closed) {
                return
            }
            writer.timer = window.setTimeout(() => {
                writer.timer = null
                redraw()
            }, 80)
        }

        return {
            append(delta) {
                const text = String(delta || "")
                if (!text || writer.closed) {
                    return
                }
                writer.accumulated += text
                writer.wroteContent = true
                scheduleRedraw()
            },
            flush() {
                if (writer.timer) {
                    window.clearTimeout(writer.timer)
                    writer.timer = null
                }
                redraw()
            },
            finish() {
                if (writer.closed) {
                    return
                }
                this.flush()
                host.appendVisibleText("\n——\n")
                writer.closed = true
            },
            fail(message) {
                if (writer.closed) {
                    return
                }
                this.flush()
                host.appendVisibleText(`\n[输出中断：${message || "未知错误"}]\n——\n`)
                writer.closed = true
            },
            hasContent() {
                return writer.wroteContent
            }
        }
    }

    function writeReplyAtSelection(markdownText, replaceSelection) {
        const value = host.normalizeText(markdownText)
        if (!value) {
            throw new Error("当前没有可写回文档的内容")
        }
        const range = host.getSelectionRange()
        if (!range) {
            throw new Error("当前没有可写入的位置，请先将光标放入文档")
        }
        if (replaceSelection) {
            renderMarkdown(range, value)
            if (typeof range.Select === "function") {
                range.Select()
            }
            return
        }
        const insertionRange = host.collapseToEnd(range && range.Duplicate ? range.Duplicate : range)
        renderMarkdown(insertionRange, value)
    }

    app.render.wps = {
        renderMarkdown,
        createConversationWriter,
        writeReplyAtSelection
    }
})(window.WpsAiAssistantClean)

