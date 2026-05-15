/**
 * Unit tests for the Phase 3 / step 5 image-cleanup helpers in the
 * product-reviews module:
 *
 *   - {@link deleteReviewImagesViaFileModule}
 *
 * Pure-function tests with an in-memory fake container that resolves
 * `Modules.FILE` to a stub matching the
 * `IFileModuleService.deleteFiles(ids[])` contract.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { Modules } from "@medusajs/framework/utils"

import {
  deleteReviewImagesViaFileModule,
} from "../product-reviews"

function buildContainer(impl: {
  deleteFiles?: (ids: string[]) => Promise<void>
}) {
  const fileService = {
    createFiles: jest.fn(),
    deleteFiles: impl.deleteFiles
      ? jest.fn(impl.deleteFiles as any)
      : jest.fn<any>(async () => {}),
  }
  const container = {
    resolve: jest.fn((key: any) => {
      if (key === Modules.FILE) {
        return fileService
      }
      return undefined
    }),
  }
  return { container, fileService }
}

describe("deleteReviewImagesViaFileModule", () => {
  it("returns ok with attempted=0 when images is null/empty", async () => {
    const { container, fileService } = buildContainer({})

    const r1 = await deleteReviewImagesViaFileModule({
      container,
      images: null,
    })
    expect(r1).toEqual({ ok: true, attempted: 0, deleted: 0 })

    const r2 = await deleteReviewImagesViaFileModule({
      container,
      images: [],
    })
    expect(r2).toEqual({ ok: true, attempted: 0, deleted: 0 })

    expect(fileService.deleteFiles).not.toHaveBeenCalled()
  })

  it("forwards ids to fileModule.deleteFiles and reports counts", async () => {
    const { container, fileService } = buildContainer({})

    const result = await deleteReviewImagesViaFileModule({
      container,
      images: [
        { id: "id_a", url: "https://cdn/a.jpg" },
        { id: "id_b", url: "https://cdn/b.jpg" },
      ],
    })

    expect(result).toEqual({ ok: true, attempted: 2, deleted: 2 })
    expect(fileService.deleteFiles).toHaveBeenCalledWith(["id_a", "id_b"])
  })

  it("skips legacy entries where id === url (cannot be deleted)", async () => {
    const { container, fileService } = buildContainer({})

    const result = await deleteReviewImagesViaFileModule({
      container,
      images: [
        { id: "https://cdn/legacy.jpg", url: "https://cdn/legacy.jpg" },
        { id: "id_b", url: "https://cdn/b.jpg" },
      ],
    })

    expect(result).toEqual({ ok: true, attempted: 1, deleted: 1 })
    expect(fileService.deleteFiles).toHaveBeenCalledWith(["id_b"])
  })

  it("returns ok=false with error message when deleteFiles throws", async () => {
    const { container } = buildContainer({
      deleteFiles: async () => {
        throw new Error("S3 down")
      },
    })

    const warn = jest.fn()
    const result = await deleteReviewImagesViaFileModule({
      container,
      images: [{ id: "id_a", url: "https://cdn/a.jpg" }],
      logger: { warn },
    })

    expect(result.ok).toBe(false)
    expect(result.deleted).toBe(0)
    expect(result.attempted).toBe(1)
    expect(result.error).toBe("S3 down")
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("returns ok=false when file module is unavailable", async () => {
    // Container that fails to resolve Modules.FILE.
    const container = {
      resolve: jest.fn(() => {
        throw new Error("unbound")
      }),
    }
    const warn = jest.fn()

    const result = await deleteReviewImagesViaFileModule({
      container,
      images: [{ id: "id_a", url: "https://cdn/a.jpg" }],
      logger: { warn },
    })

    expect(result.ok).toBe(false)
    expect(result.deleted).toBe(0)
    expect(result.attempted).toBe(1)
    expect(result.error).toBe("file_module_unavailable")
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
