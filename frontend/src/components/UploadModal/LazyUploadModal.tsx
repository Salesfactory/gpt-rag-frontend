import React, { lazy, Suspense } from 'react';
import { Spinner } from '@fluentui/react';

// Lazy load the UploadModal components
const UploadModalHeader = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.UploadModalHeader 
  }))
);

const UploadModalFooter = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.UploadModalFooter 
  }))
);

const UploadingContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.UploadingContent 
  }))
);

const DragFilesContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.DragFilesContent 
  }))
);

const ExcelWarningContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.ExcelWarningContent 
  }))
);

const DuplicateWarningContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.DuplicateWarningContent 
  }))
);

const RenameFileContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.RenameFileContent 
  }))
);

const InvalidCharactersWarningContent = lazy(() => 
  import('./UploadModal').then(module => ({ 
    default: module.InvalidCharactersWarningContent 
  }))
);

// Loading fallback component
const LoadingFallback: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
    <Spinner label={label} />
  </div>
);

// Lazy wrapper components
export const LazyUploadModalHeader: React.FC = () => (
  <Suspense fallback={<LoadingFallback label="Loading upload modal..." />}>
    <UploadModalHeader />
  </Suspense>
);

export const LazyUploadModalFooter: React.FC<{ closeUploadDialog: () => void }> = (props) => (
  <Suspense fallback={<LoadingFallback />}>
    <UploadModalFooter {...props} />
  </Suspense>
);

export const LazyUploadingContent: React.FC<{ selectedFiles: any[] }> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading upload progress..." />}>
    <UploadingContent {...props} />
  </Suspense>
);

export const LazyDragFilesContent: React.FC<{ onDrop: any }> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading file drop zone..." />}>
    <DragFilesContent {...props} />
  </Suspense>
);

export const LazyExcelWarningContent: React.FC<{ 
  excelFiles: String[], 
  onConfirm: () => void, 
  onCancel: () => void 
}> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading warning..." />}>
    <ExcelWarningContent {...props} />
  </Suspense>
);

export const LazyDuplicateWarningContent: React.FC<{ 
  files: File[], 
  currentFileIndex: number,
  onRename: () => void,
  onReplace: () => void,
  onCancel: () => void
}> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading warning..." />}>
    <DuplicateWarningContent {...props} />
  </Suspense>
);

export const LazyRenameFileContent: React.FC<{ 
  fileName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading rename dialog..." />}>
    <RenameFileContent {...props} />
  </Suspense>
);

export const LazyInvalidCharactersWarningContent: React.FC<{ 
  invalidFiles: string[];
  onCancel: () => void;
}> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading warning..." />}>
    <InvalidCharactersWarningContent {...props} />
  </Suspense>
);
