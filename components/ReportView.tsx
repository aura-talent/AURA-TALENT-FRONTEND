import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ReportView({ markdown }: { markdown: string }) {
  return (
    <div className="report">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "underline", color: "var(--iris)" }}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
