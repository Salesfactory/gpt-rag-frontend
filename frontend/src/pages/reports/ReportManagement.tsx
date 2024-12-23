import React from "react";
import { useNavigate } from "react-router-dom";
import { DocumentData24Regular, DocumentText24Regular, DocumentTable24Regular } from "@fluentui/react-icons";

interface ReportCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    onClick: () => void;
}

interface CardData {
    title: string;
    description: string;
    icon: React.ElementType;
    route: string;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, description, icon: Icon, onClick }) => {
    return (
        <div
            className="card h-100 shadow-sm"
            onClick={onClick}
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.transform = "translateY(-4px)")}
            onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}
        >
            <div className="card-body text-center p-4">
                <div className="d-flex justify-content-center mb-3">
                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: "64px", height: "64px" }}>
                        <Icon fontSize={24} />
                    </div>
                </div>
                <h3 className="h5 mb-2">{title}</h3>
                <p className="text-muted small mb-0">{description}</p>
            </div>
        </div>
    );
};

const ReportManagement: React.FC = () => {
    const navigate = useNavigate();

    const cards: CardData[] = [
        {
            title: "Curation Reports",
            description: "Manage and create custom curation reports",
            icon: DocumentData24Regular,
            route: "/curation-reports"
        },
        {
            title: "Summarization Reports",
            description: "Create and manage custom summarization reports",
            icon: DocumentText24Regular,
            route: "/summarization-reports"
        },
        {
            title: "Summarization Report Templates",
            description: "Manage report templates",
            icon: DocumentTable24Regular,
            route: "/report-templates"
        }
    ];

    const handleNavigation = (route: string): void => {
        navigate(route);
    };

    return (
        <div className="min-vh-100 bg-light">
            <div className="bg-white shadow-sm mb-4">
                <div className="container py-4">
                    <h1 className="h3 mb-0">Report Management</h1>
                </div>
            </div>

            <div className="container py-4">
                <div className="row g-4">
                    {cards.map((card, index) => (
                        <div key={index} className="col-12 col-md-4">
                            <ReportCard {...card} onClick={() => handleNavigation(card.route)} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReportManagement;
