import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  const getIcon = (variant?: string) => {
    const iconProps = "w-5 h-5 flex-shrink-0 mt-0.5"
    switch (variant) {
      case "success":
        return <CheckCircle2 className={`${iconProps} text-green-500`} />
      case "destructive":
        return <AlertCircle className={`${iconProps} text-red-500`} />
      case "warning":
        return <AlertTriangle className={`${iconProps} text-yellow-500`} />
      case "info":
        return <Info className={`${iconProps} text-blue-500`} />
      default:
        return null
    }
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any).variant || "default"
        return (
          <Toast key={id} variant={variant as any} {...props}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {getIcon(variant)}
              <div className="grid gap-1.5 flex-1 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action && <div className="ml-2 flex-shrink-0">{action}</div>}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
