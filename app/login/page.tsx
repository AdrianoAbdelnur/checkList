import LoginForm from '../../components/LoginForm'

export const metadata = {
  title: 'Entrar',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 text-white rounded-full p-3 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L20 6.5V17.5L12 22L4 17.5V6.5L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold">Entrar a mi cuenta</h1>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
