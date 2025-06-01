import { z } from 'zod';
import { router, publicProcedure, organizerProcedure } from '../server';
import { TRPCError } from '@trpc/server';

export const boothRouter = router({
  // ดูบูธทั้งหมดในงาน
  getByEventId: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.booth.findMany({
        where: { eventId: input.eventId },
        orderBy: { createdAt: 'asc' }
      });
    }),

  // สร้างบูธใหม่
  create: organizerProcedure
    .input(z.object({
      eventId: z.string(),
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(30),
      height: z.number().min(30),
      name: z.string().min(1).max(100),
      color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { createdBy: true }
      });

      if (!event || event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only add booths to your own events'
        });
      }

      return await ctx.prisma.booth.create({
        data: input
      });
    }),

  // อัพเดทบูธ
  update: organizerProcedure
    .input(z.object({
      id: z.string(),
      x: z.number().min(0).optional(),
      y: z.number().min(0).optional(),
      width: z.number().min(30).optional(),
      height: z.number().min(30).optional(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
      const booth = await ctx.prisma.booth.findUnique({
        where: { id },
        include: {
          event: {
            select: { createdBy: true }
          }
        }
      });

      if (!booth || booth.event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update booths in your own events'
        });
      }

      return await ctx.prisma.booth.update({
        where: { id },
        data
      });
    }),

  // ลบบูธ
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const booth = await ctx.prisma.booth.findUnique({
        where: { id: input.id },
        include: {
          event: {
            select: { createdBy: true }
          }
        }
      });

      if (!booth || booth.event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete booths in your own events'
        });
      }

      return await ctx.prisma.booth.delete({
        where: { id: input.id }
      });
    }),

  // อัพเดทหลายบูธพร้อมกัน (สำหรับ drag multiple)
  updateMany: organizerProcedure
    .input(z.object({
      eventId: z.string(),
      booths: z.array(z.object({
        id: z.string(),
        x: z.number().min(0),
        y: z.number().min(0),
        width: z.number().min(30).optional(),
        height: z.number().min(30).optional(),
        name: z.string().min(1).max(100).optional()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { createdBy: true }
      });

      if (!event || event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update booths in your own events'
        });
      }

      // ใช้ transaction เพื่อ update หลายบูธพร้อมกัน
      return await ctx.prisma.$transaction(
        input.booths.map(booth =>
          ctx.prisma.booth.update({
            where: { id: booth.id },
            data: {
              x: booth.x,
              y: booth.y,
              ...(booth.width && { width: booth.width }),
              ...(booth.height && { height: booth.height }),
              ...(booth.name && { name: booth.name })
            }
          })
        )
      );
    })
});