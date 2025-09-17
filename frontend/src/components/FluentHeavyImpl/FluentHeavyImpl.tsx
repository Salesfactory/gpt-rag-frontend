import React, { lazy, Suspense } from 'react';
import { Spinner } from '@fluentui/react';

// Lazy load heavy Fluent UI components
const DetailsList = lazy(() => 
  import('@fluentui/react/lib/DetailsList').then(module => ({ 
    default: module.DetailsList 
  }))
);

const ContextualMenu = lazy(() => 
  import('@fluentui/react/lib/ContextualMenu').then(module => ({ 
    default: module.ContextualMenu 
  }))
);

const Callout = lazy(() => 
  import('@fluentui/react/lib/Callout').then(module => ({ 
    default: module.Callout 
  }))
);

// Loading fallback component
const LoadingFallback: React.FC<{ label?: string }> = ({ label = "Loading component..." }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
    <Spinner label={label} />
  </div>
);

// Wrapper components with Suspense
export const LazyDetailsList: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading file list..." />}>
    <DetailsList {...props} />
  </Suspense>
);

export const LazyContextualMenu: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading menu..." />}>
    <ContextualMenu {...props} />
  </Suspense>
);

export const LazyCallout: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading callout..." />}>
    <Callout {...props} />
  </Suspense>
);

// For dynamic imports, export the actual enums and types when needed
export const getDetailsListLayoutMode = async () => {
  const module = await import('@fluentui/react/lib/DetailsList');
  return module.DetailsListLayoutMode;
};

export const getSelectionMode = async () => {
  const module = await import('@fluentui/react/lib/DetailsList');
  return module.SelectionMode;
};

// IColumn is a TypeScript interface, not a runtime value, so we can't dynamically import it
// Instead, we'll import it statically since it's just a type definition
export type { IColumn } from '@fluentui/react/lib/DetailsList';

// Export static enum values for immediate use (without lazy loading the whole module)
export const DetailsListLayoutMode = {
  justified: 0,
  fixedColumns: 1
};

export const SelectionMode = {
  none: 0,
  single: 1,
  multiple: 2
};
