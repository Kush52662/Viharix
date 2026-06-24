import React, { useRef, useEffect } from "react";
import { Box, IconButton } from "@mui/material";
import { Bold, Italic, Underline, List, ListOrdered, Trash2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Add notes here...", id }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Set initial content only if it differs to avoid caret jumping
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    handleInput();
  };

  return (
    <Box 
      sx={{ 
        border: "1px solid rgba(0, 0, 0, 0.23)", 
        borderRadius: 1.5, 
        overflow: "hidden", 
        "&:hover": { borderColor: "text.primary" }, 
        "&:focus-within": { borderColor: "primary.main", borderWidth: 2, m: "-1px" } 
      }}
    >
      <Box 
        sx={{ 
          display: "flex", 
          gap: 0.5, 
          p: 0.8, 
          bgcolor: "rgba(0, 0, 0, 0.02)", 
          borderBottom: "1px solid rgba(0,0,0,0.08)", 
          flexWrap: "wrap" 
        }}
      >
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("bold")} 
          title="Bold"
          sx={{ borderRadius: 1 }}
        >
          <Bold size={16} />
        </IconButton>
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("italic")} 
          title="Italic"
          sx={{ borderRadius: 1 }}
        >
          <Italic size={16} />
        </IconButton>
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("underline")} 
          title="Underline"
          sx={{ borderRadius: 1 }}
        >
          <Underline size={16} />
        </IconButton>
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("insertUnorderedList")} 
          title="Bullet List"
          sx={{ borderRadius: 1 }}
        >
          <List size={16} />
        </IconButton>
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("insertOrderedList")} 
          title="Numbered List"
          sx={{ borderRadius: 1 }}
        >
          <ListOrdered size={16} />
        </IconButton>
        <IconButton 
          size="small" 
          type="button"
          onClick={() => execCommand("removeFormat")} 
          title="Clear Formatting"
          sx={{ borderRadius: 1 }}
        >
          <Trash2 size={16} />
        </IconButton>
      </Box>
      
      <style>{`
        .editor-content-area[contenteditable=true]:empty:before {
          content: attr(data-placeholder);
          color: rgba(0, 0, 0, 0.42);
          position: absolute;
          pointer-events: none;
          display: block;
        }
        .editor-content-area ul { list-style-type: disc; padding-left: 20px; margin: 4px 0; }
        .editor-content-area ol { list-style-type: decimal; padding-left: 20px; margin: 4px 0; }
      `}</style>

      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: 120,
          padding: "16px",
          outline: "none",
          fontFamily: "inherit",
          fontSize: "0.875rem",
          overflowY: "auto",
          backgroundColor: "#FFFFFF",
          color: "rgba(0, 0, 0, 0.87)",
          position: "relative",
        }}
        className="editor-content-area"
      />
    </Box>
  );
}
