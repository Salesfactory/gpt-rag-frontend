import React from 'react';

const AccessDenied: React.FC = () => {
    return (
        <div
        style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
        }}
        >
            <h1>Access Denied</h1>
            <p>You do not have permission to access this page.</p>
        </div>
    );
};

export default AccessDenied;