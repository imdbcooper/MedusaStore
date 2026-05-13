import { startVkLogin } from "@lib/data/customer"
import { VK_ID_ENABLED } from "@lib/config"

type VkLoginButtonProps = {
  countryCode: string
  className?: string
}

/**
 * Static, design-only "Sign in with VK" button. Phase 5.1 ships **without** the
 * VK ID JS SDK — the button submits a server form that calls the public
 * `POST /store/auth/vk-id/start` Medusa route and redirects the browser to the
 * VK authorize URL.
 *
 * Brand color (#0077FF) and SVG mark are taken from the VK ID embed reference
 * in `plans/vk.html` so the visual surface matches the official guidance.
 */
export default function VkLoginButton({
  countryCode,
  className,
}: VkLoginButtonProps) {
  if (!VK_ID_ENABLED) {
    return null
  }

  return (
    <form action={startVkLogin.bind(null, countryCode)} className="w-full">
      <button
        type="submit"
        data-testid="vk-login-button"
        className={
          className ||
          "flex w-full items-center justify-center gap-x-2 rounded-rounded bg-[#0077FF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#005FD9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0077FF] focus-visible:ring-offset-2 disabled:opacity-60"
        }
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          focusable="false"
        >
          <path d="M12.785 16.241h.94c.348-.034.601-.302.704-.61.244-.79.193-1.918.94-2.066.586-.05 1.348.708 2.184 1.708.625.797.94 1.022 1.367 1.066h2.116c.518-.012.793-.207.866-.466.135-.493-.43-1.27-1.41-2.475-.683-.85-1.2-1.422-1.49-1.749-.45-.512-.467-.752-.06-1.296.205-.265.487-.605.85-1.029.81-.953 1.477-1.733 1.7-2.214.221-.443.31-.875.038-1.131-.21-.197-.65-.262-1.155-.235H17.66c-.34-.001-.55.014-.692.232-.18.279-.273.553-.486 1.064-.512 1.235-1.225 2.412-1.69 2.987-.288.345-.471.46-.6.46-.149 0-.225-.115-.225-.555V8.93c0-.953-.227-1.318-.829-1.318h-2.92c-.45 0-.717.197-.717.467 0 .898.852.992.852 2.595v1.706c0 .986-.183 1.118-.43 1.118-.671 0-1.79-1.41-2.49-3.215-.293-.748-.466-1.232-.617-1.65-.115-.317-.252-.488-.692-.488H4.018c-.405 0-.621.166-.621.518 0 .906 1.073 3.97 3.13 6.706 1.55 2.034 3.55 3.293 5.484 3.32.49 0 .742-.197.774-.448z" />
        </svg>
        <span>Войти через ВКонтакте</span>
      </button>
    </form>
  )
}
