// Lazy-loaded components for better bundle optimization
export {
  LazyUploadModalHeader,
  LazyUploadModalFooter,
  LazyUploadingContent,
  LazyDragFilesContent,
  LazyExcelWarningContent,
  LazyDuplicateWarningContent,
  LazyRenameFileContent
} from './LazyUploadModal';

// Original components still available for direct imports if needed
export {
  UploadModalHeader,
  UploadModalFooter,
  UploadingContent,
  DragFilesContent,
  ExcelWarningContent,
  DuplicateWarningContent,
  RenameFileContent
} from './UploadModal';
