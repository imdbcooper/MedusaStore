type MedusaErrorLike = {
  response?: {
    data?: { message?: string } | string
    status?: number
    headers?: unknown
  }
  request?: unknown
  config?: {
    url?: string
    baseURL?: string
  }
  message?: string
}

type MedusaResponseData = { message?: string } | string | undefined

const getResponseMessage = (data: MedusaResponseData) => {
  if (typeof data === "string") {
    return data
  }

  if (data && typeof data === "object" && "message" in data) {
    const message = data.message

    if (typeof message === "string") {
      return message
    }
  }

  return "Unknown error"
}

export default function medusaError(error: unknown): never {
  const medusaLikeError = error as MedusaErrorLike

  if (medusaLikeError.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const resource =
      medusaLikeError.config?.url && medusaLikeError.config.baseURL
        ? new URL(
            medusaLikeError.config.url,
            medusaLikeError.config.baseURL
          ).toString()
        : medusaLikeError.config?.url || "unknown"
    console.error("Resource:", resource)
    console.error("Response data:", medusaLikeError.response.data)
    console.error("Status code:", medusaLikeError.response.status)
    console.error("Headers:", medusaLikeError.response.headers)

    // Extracting the error message from the response data
    const message = getResponseMessage(medusaLikeError.response.data)

    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  } else if (medusaLikeError.request) {
    // The request was made but no response was received
    throw new Error("No response received: " + String(medusaLikeError.request))
  } else {
    // Something happened in setting up the request that triggered an Error
    throw new Error(
      "Error setting up the request: " +
        (medusaLikeError.message ?? String(error))
    )
  }
}
