// frontend/src/utils/errorMessages.ts

// Error codes matching backend constants
const ERROR_CODE_UNAUTHORIZED_ORG = "FORBIDDEN_ORGANIZATION_ACCESS";
const ERROR_CODE_USER_LIMIT_EXCEEDED = "USER_QUOTA_EXCEEDED";
const ERROR_CODE_ORG_LIMIT_EXCEEDED = "ORGANIZATION_QUOTA_EXCEEDED";

interface ErrorMessages {
    title: string;
    message: string;
}

export function get403ErrorMessages(errorCode?: string, daysUntilReset?: number): ErrorMessages {
    const language = navigator.language;

    switch (errorCode) {
        case ERROR_CODE_UNAUTHORIZED_ORG:
            if (language.startsWith("pt")) {
                return {
                    title: "Acesso Negado",
                    message: "Você não tem permissão para acessar esta organização. Entre em contato com o administrador se você acredita que isso é um erro."
                };
            } else if (language.startsWith("es")) {
                return {
                    title: "Acceso Denegado",
                    message: "No tiene permiso para acceder a esta organización. Póngase en contacto con el administrador si cree que esto es un error."
                };
            } else {
                return {
                    title: "Access Denied",
                    message: "You don't have permission to access this organization. Contact your administrator if you believe this is an error."
                };
            }

        case ERROR_CODE_ORG_LIMIT_EXCEEDED:
            if (language.startsWith("pt")) {
                return {
                    title: "Limite da Organização Atingido",
                    message: "Sua organização atingiu o limite mensal de créditos. Entre em contato com o administrador para aumentar a cota ou aguarde até o próximo ciclo de faturamento."
                };
            } else if (language.startsWith("es")) {
                return {
                    title: "Límite de Organización Alcanzado",
                    message: "Su organización ha alcanzado el límite mensual de créditos. Póngase en contacto con el administrador para aumentar la cuota o espere hasta el próximo ciclo de facturación."
                };
            } else {
                return {
                    title: "Organization Limit Reached",
                    message: "Your organization has reached its monthly credit limit. Contact your administrator to increase the quota or wait until the next billing cycle."
                };
            }

        case ERROR_CODE_USER_LIMIT_EXCEEDED:
            const daysText = daysUntilReset || 0;
            if (language.startsWith("pt")) {
                return {
                    title: "Limite de Créditos Mensais Atingido",
                    message: `Você atingiu seu limite mensal de créditos. Você poderá fazer mais perguntas em ${daysText} dias quando seu ciclo de faturamento for reiniciado. Até lá, sinta-se à vontade para revisar insights anteriores—estaremos prontos quando você estiver.`
                };
            } else if (language.startsWith("es")) {
                return {
                    title: "Límite de Créditos Mensuales Alcanzado",
                    message: `Ha alcanzado su límite mensual de créditos. Podrá hacer más preguntas en ${daysText} días cuando se reinicie su ciclo de facturación. Hasta entonces, siéntase libre de revisar información anterior—estaremos listos cuando usted esté.`
                };
            } else {
                return {
                    title: "Monthly Credit Limit Reached",
                    message: `You've reached your monthly credit limit. You'll be able to ask more questions in ${daysText} days when your billing cycle resets. Until then, feel free to review past insights—we'll be ready when you are.`
                };
            }

        default:
            // Fallback for unknown error codes
            if (language.startsWith("pt")) {
                return {
                    title: "Acesso Negado",
                    message: "Você não tem permissão para executar esta ação. Entre em contato com o suporte se o problema persistir."
                };
            } else if (language.startsWith("es")) {
                return {
                    title: "Acceso Denegado",
                    message: "No tiene permiso para realizar esta acción. Póngase en contacto con el soporte si el problema persiste."
                };
            } else {
                return {
                    title: "Access Denied",
                    message: "You don't have permission to perform this action. Contact support if this issue persists."
                };
            }
    }
}

export function getPlaceholderText(errorCode?: string): string {
    const language = navigator.language;

    if (!errorCode) {
        // Default placeholder
        if (language.startsWith("pt")) {
            return "Escreva aqui sua pergunta";
        } else if (language.startsWith("es")) {
            return "Escribe tu pregunta aqui";
        } else {
            return "Write your question here";
        }
    }

    // Disabled state placeholders
    switch (errorCode) {
        case ERROR_CODE_UNAUTHORIZED_ORG:
            if (language.startsWith("pt")) {
                return "Acesso negado a esta organização";
            } else if (language.startsWith("es")) {
                return "Acceso denegado a esta organización";
            } else {
                return "Access denied to this organization";
            }

        case ERROR_CODE_ORG_LIMIT_EXCEEDED:
            if (language.startsWith("pt")) {
                return "Limite da organização atingido";
            } else if (language.startsWith("es")) {
                return "Límite de organización alcanzado";
            } else {
                return "Organization limit reached";
            }

        case ERROR_CODE_USER_LIMIT_EXCEEDED:
            if (language.startsWith("pt")) {
                return "Limite mensal atingido. Aguarde o próximo ciclo.";
            } else if (language.startsWith("es")) {
                return "Límite mensual alcanzado. Espere el próximo ciclo.";
            } else {
                return "Monthly limit reached. Wait for next cycle.";
            }

        default:
            if (language.startsWith("pt")) {
                return "Acesso negado";
            } else if (language.startsWith("es")) {
                return "Acceso denegado";
            } else {
                return "Access denied";
            }
    }
}
