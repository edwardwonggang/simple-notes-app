import tkinter as tk
from tkinter import messagebox, font
import pyperclip

class SimpleNotesApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("便签")
        self.root.geometry("338x450")  # 原来450x600的3/4

        # 强制置顶 - 无需按钮控制
        self.root.attributes('-topmost', True)
        # 禁用最大化按钮，只允许调整大小
        self.root.resizable(True, True)
        self.root.attributes('-toolwindow', True)  # 去掉最大化按钮

        # Notepad++风格配色
        self.bg_color = "#2D2D30"          # 深灰背景
        self.text_bg = "#1E1E1E"           # 文本区域背景
        self.text_fg = "#DCDCDC"           # 文本颜色
        self.select_bg = "#264F78"         # 选择背景
        self.cursor_color = "#AEAFAD"      # 光标颜色

        self.root.configure(bg=self.bg_color)

        # 创建主框架
        self.main_frame = tk.Frame(self.root, bg=self.bg_color)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # 创建简洁工具栏
        self.create_minimal_toolbar()

        # 创建编辑器
        self.create_editor()

        # 绑定事件
        self.bind_events()

        # 点击计数器和定时器
        self.click_count = 0
        self.click_timer = None
        
    def create_minimal_toolbar(self):
        """创建极简工具栏"""
        toolbar = tk.Frame(self.main_frame, bg="#3C3C3C", height=28)
        toolbar.pack(fill=tk.X)
        toolbar.pack_propagate(False)

        # 只保留清空按钮，样式更简洁
        self.clear_btn = tk.Button(
            toolbar,
            text="清空",
            font=("Microsoft YaHei UI", 9),
            bg="#3C3C3C",
            fg="#CCCCCC",
            relief=tk.FLAT,
            borderwidth=0,
            cursor="hand2",
            command=self.clear_text,
            padx=12,
            pady=4
        )
        self.clear_btn.pack(side=tk.RIGHT, padx=8, pady=2)

        # 鼠标悬停效果
        def on_enter(e):
            self.clear_btn.configure(bg="#007ACC", fg="white")
        def on_leave(e):
            self.clear_btn.configure(bg="#3C3C3C", fg="#CCCCCC")

        self.clear_btn.bind("<Enter>", on_enter)
        self.clear_btn.bind("<Leave>", on_leave)

    def create_editor(self):
        """创建彩色文本编辑器"""
        # 创建编辑器容器
        editor_frame = tk.Frame(self.main_frame, bg=self.bg_color)
        editor_frame.pack(fill=tk.BOTH, expand=True)

        # 创建文本容器
        content_frame = tk.Frame(editor_frame, bg=self.text_bg)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=1, pady=1)

        # 主文本编辑器
        self.text_widget = tk.Text(
            content_frame,
            font=("Consolas", 12),
            bg=self.text_bg,
            fg=self.text_fg,
            relief=tk.FLAT,
            borderwidth=0,
            padx=15,
            pady=15,
            wrap=tk.WORD,
            selectbackground=self.select_bg,
            selectforeground="white",
            insertbackground=self.cursor_color,
            insertwidth=1,
            undo=True,
            maxundo=50
        )
        self.text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 滚动条
        scrollbar = tk.Scrollbar(
            content_frame,
            orient=tk.VERTICAL,
            command=self.text_widget.yview,
            bg=self.bg_color,
            troughcolor=self.text_bg,
            activebackground="#007ACC"
        )
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.text_widget.configure(yscrollcommand=scrollbar.set)

        # 定义颜色列表
        self.colors = [
            "#FF6B6B",  # 红色
            "#4ECDC4",  # 青色
            "#45B7D1",  # 蓝色
            "#96CEB4",  # 绿色
            "#FFEAA7",  # 黄色
            "#DDA0DD",  # 紫色
            "#98D8C8",  # 薄荷绿
            "#F7DC6F",  # 金黄色
            "#BB8FCE",  # 淡紫色
            "#85C1E9",  # 天蓝色
            "#F8C471",  # 橙色
            "#82E0AA",  # 浅绿色
            "#F1948A",  # 粉红色
            "#85C1E9",  # 浅蓝色
            "#D7BDE2",  # 薰衣草色
        ]

        # 为每种颜色创建标签
        for i, color in enumerate(self.colors):
            self.text_widget.tag_configure(f"color_{i}", foreground=color)

        # 绑定文本变化事件
        self.text_widget.bind('<KeyRelease>', self.colorize_text)
        self.text_widget.bind('<Button-1>', self.colorize_text)
        self.text_widget.bind('<ButtonRelease-1>', self.colorize_text)

        # 设置焦点
        self.text_widget.focus_set()

    def colorize_text(self, event=None):
        """为每个用空格分隔的字符串着色"""
        # 获取所有文本内容
        content = self.text_widget.get("1.0", "end-1c")

        # 清除所有现有的颜色标签
        for i in range(len(self.colors)):
            self.text_widget.tag_remove(f"color_{i}", "1.0", tk.END)

        if not content.strip():
            return

        # 按空格分割所有单词
        words = []
        current_pos = "1.0"

        lines = content.split('\n')
        for line_num, line in enumerate(lines, 1):
            if line.strip():
                # 分割每行的单词
                line_words = line.split()
                col_start = 0

                for word in line_words:
                    # 找到单词在行中的位置
                    word_start = line.find(word, col_start)
                    if word_start != -1:
                        start_pos = f"{line_num}.{word_start}"
                        end_pos = f"{line_num}.{word_start + len(word)}"
                        words.append((word, start_pos, end_pos))
                        col_start = word_start + len(word)

        # 为每个单词分配颜色
        unique_words = {}
        color_index = 0

        for word, start_pos, end_pos in words:
            if word not in unique_words:
                unique_words[word] = color_index % len(self.colors)
                color_index += 1

            # 应用颜色标签
            color_tag = f"color_{unique_words[word]}"
            self.text_widget.tag_add(color_tag, start_pos, end_pos)
        
    def bind_events(self):
        # 绑定双击和三击事件
        self.text_widget.bind("<Button-1>", self.on_click)
        self.text_widget.bind("<Button-3>", self.on_right_click)  # 右键点击
        
    def on_click(self, event):
        """处理点击事件，实现双击复制和三击全选"""
        self.click_count += 1
        
        # 取消之前的定时器
        if self.click_timer:
            self.root.after_cancel(self.click_timer)
        
        # 设置新的定时器
        self.click_timer = self.root.after(300, self.reset_click_count)
        
        if self.click_count == 2:
            # 双击复制当前行
            self.copy_current_line(event)
        elif self.click_count == 3:
            # 三击选择全部
            self.select_all()
            
    def reset_click_count(self):
        """重置点击计数"""
        self.click_count = 0
        self.click_timer = None
        
    def copy_current_line(self, event):
        """复制当前行文字"""
        try:
            # 获取点击位置
            index = self.text_widget.index(f"@{event.x},{event.y}")
            line_start = self.text_widget.index(f"{index} linestart")
            line_end = self.text_widget.index(f"{index} lineend")
            
            # 获取当前行文字
            current_line = self.text_widget.get(line_start, line_end).strip()
            
            if current_line:
                # 复制到剪贴板
                pyperclip.copy(current_line)
                self.show_feedback("已复制当前行")
            else:
                self.show_feedback("当前行为空")
                
        except Exception as e:
            self.show_feedback("复制失败")
            
    def select_all(self):
        """选择所有文字"""
        self.text_widget.tag_add(tk.SEL, "1.0", tk.END)
        self.text_widget.mark_set(tk.INSERT, "1.0")
        self.text_widget.see(tk.INSERT)
        self.show_feedback("已选择全部文字")
        
    def on_right_click(self, event):
        """右键粘贴"""
        try:
            # 获取剪贴板内容
            clipboard_text = pyperclip.paste()
            if clipboard_text:
                # 在光标位置插入文字
                cursor_pos = self.text_widget.index(tk.INSERT)
                self.text_widget.insert(cursor_pos, clipboard_text)
                self.show_feedback("已粘贴文字")
            else:
                self.show_feedback("剪贴板为空")
        except Exception as e:
            self.show_feedback("粘贴失败")
            
    def clear_text(self):
        """清空文本 - 直接清空无需确认"""
        if self.text_widget.get("1.0", "end-1c").strip():
            self.text_widget.delete("1.0", tk.END)
            self.show_feedback("已清空")
        else:
            self.show_feedback("内容为空")

    def show_feedback(self, message):
        """显示操作反馈"""
        # 创建状态栏风格的反馈
        feedback_frame = tk.Frame(
            self.root,
            bg="#007ACC",
            relief=tk.FLAT
        )

        feedback_label = tk.Label(
            feedback_frame,
            text=f"  {message}  ",
            font=("Microsoft YaHei UI", 9),
            bg="#007ACC",
            fg="white",
            padx=8,
            pady=3
        )
        feedback_label.pack()

        # 右下角显示
        feedback_frame.place(relx=0.98, rely=0.95, anchor=tk.SE)

        # 1秒后消失
        self.root.after(1000, feedback_frame.destroy)
        
    def run(self):
        """运行应用"""
        self.root.mainloop()

if __name__ == "__main__":
    try:
        app = SimpleNotesApp()
        app.run()
    except ImportError as e:
        print("缺少依赖库，请安装：pip install pyperclip")
        print(f"错误详情：{e}")
    except Exception as e:
        print(f"程序运行出错：{e}")
