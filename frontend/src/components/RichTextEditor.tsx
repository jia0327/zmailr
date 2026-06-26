import React, { useCallback, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export const MAX_INLINE_IMAGE_BYTES = 500 * 1024;

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onImageTooLarge?: () => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onImageTooLarge,
  placeholder,
  className = '',
}) => {
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        onImageTooLarge?.();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const quill = quillRef.current?.getEditor();
        if (!quill || typeof reader.result !== 'string') return;
        const range = quill.getSelection(true);
        const index = range?.index ?? quill.getLength();
        quill.insertEmbed(index, 'image', reader.result);
        quill.setSelection({ index: index + 1, length: 0 });
      };
      reader.readAsDataURL(file);
    };
  }, [onImageTooLarge]);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [['bold', 'italic', 'link', 'image']],
        handlers: { image: imageHandler },
      },
    }),
    [imageHandler],
  );

  const formats = useMemo(() => ['bold', 'italic', 'link', 'image'], []);

  return (
    <div className={`rich-text-editor ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
