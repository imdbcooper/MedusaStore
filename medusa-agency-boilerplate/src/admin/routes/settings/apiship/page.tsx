import { defineRouteConfig } from "@medusajs/admin-sdk"
import { HandTruck } from "@medusajs/icons"
import { Container, Heading, Input, Label, Switch, Text, Button } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

type ApiShipSettings = {
  enabled: boolean
  modes: {
    door_to_door: boolean
    dropoff_to_door: boolean
    door_to_point: boolean
    dropoff_to_point: boolean
  }
  updated_at: string | null
}

const defaultSettings: ApiShipSettings = {
  enabled: false,
  modes: {
    door_to_door: true,
    dropoff_to_door: false,
    door_to_point: true,
    dropoff_to_point: false,
  },
  updated_at: null,
}

const labels: Record<keyof ApiShipSettings["modes"], string> = {
  door_to_door: "door_to_door — pickupType=1, deliveryType=1",
  dropoff_to_door: "dropoff_to_door — pickupType=2, deliveryType=1",
  door_to_point: "door_to_point — pickupType=1, deliveryType=2",
  dropoff_to_point: "dropoff_to_point — pickupType=2, deliveryType=2",
}

const ApiShipSettingsPage = () => {
  const [settings, setSettings] = useState<ApiShipSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch("/admin/apiship/settings", {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return (await response.json()) as { settings?: ApiShipSettings }
      })
      .then((payload) => {
        if (!cancelled) {
          setSettings(payload.settings || defaultSettings)
          setError(null)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "settings_load_failed")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const shopperSummary = useMemo(() => {
    const doorModes = [settings.modes.door_to_door, settings.modes.dropoff_to_door].filter(Boolean)
      .length
    const pointModes = [settings.modes.door_to_point, settings.modes.dropoff_to_point].filter(Boolean)
      .length

    return {
      door: settings.enabled && doorModes > 0,
      point: settings.enabled && pointModes > 0,
    }
  }, [settings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch("/admin/apiship/settings", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          modes: settings.modes,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = (await response.json()) as { settings?: ApiShipSettings }
      setSettings(payload.settings || settings)
      setNotice("Настройки ApiShip сохранены")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "settings_save_failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">ApiShip settings</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Backend-managed seller controls for shopper-visible modes “До двери” и “В пункт выдачи”.
          </Text>
        </div>
        <Button onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
          Сохранить
        </Button>
      </div>

      <div className="grid gap-6 px-6 py-4">
        {error ? (
          <Text className="text-ui-fg-error">Ошибка: {error}</Text>
        ) : null}
        {notice ? <Text className="text-ui-fg-interactive">{notice}</Text> : null}

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">ApiShip enabled</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Global seller switch. Secrets such as APISHIP_TOKEN are not edited here.
              </Text>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  enabled: checked,
                }))
              }
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Heading level="h2">Technical mode matrix</Heading>
          <Text className="text-ui-fg-subtle mt-2 mb-4">
            Shopper sees only two modes. Seller decides which pickupType combinations are allowed behind each shopper-visible mode.
          </Text>

          <div className="grid gap-4">
            {(Object.keys(labels) as Array<keyof ApiShipSettings["modes"]>).map((key) => {
              return (
                <div key={key} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div>
                    <Label>{labels[key]}</Label>
                  </div>
                  <Switch
                    checked={settings.modes[key]}
                    onCheckedChange={(checked) =>
                      setSettings((current) => ({
                        ...current,
                        modes: {
                          ...current.modes,
                          [key]: checked,
                        },
                      }))
                    }
                    disabled={isLoading}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Heading level="h2">Shopper-visible summary</Heading>
          <div className="grid gap-3 mt-4">
            <div>
              <Label>До двери</Label>
              <Input readOnly value={shopperSummary.door ? "enabled" : "disabled"} />
            </div>
            <div>
              <Label>В пункт выдачи</Label>
              <Input readOnly value={shopperSummary.point ? "enabled" : "disabled"} />
            </div>
            <div>
              <Label>Updated at</Label>
              <Input readOnly value={settings.updated_at || "—"} />
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "ApiShip",
  icon: HandTruck,
})

export default ApiShipSettingsPage
