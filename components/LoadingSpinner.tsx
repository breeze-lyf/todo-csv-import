import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ className }: { className?: string }) {
    return <Loader2 className={`animate-spin ${className}`} />
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
                <LoadingSpinner className="h-8 w-8 text-blue-600" />
                <p className="text-sm text-gray-600">{message}</p>
            </div>
        </div>
    )
}
