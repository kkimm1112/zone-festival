import { z } from 'zod';
import { router, publicProcedure, organizerProcedure } from '../server';
import { TRPCError } from '@trpc/server';

export const eventRouter = router({
  // ดูงานทั้งหมด (สำหรับ viewer)
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.event.findMany({
      include: {
        creator: {
          select: { id: true, username: true }
        },
        _count: {
          select: { booths: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }),

  // ดูงานของตัวเอง (สำหรับ organizer)
  getMy: organizerProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.event.findMany({
      where: {
        createdBy: ctx.session.user.id
      },
      include: {
        _count: {
          select: { booths: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }),

  // ดูงานเดี่ยว
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.id },
        include: {
          creator: {
            select: { id: true, username: true }
          },
          booths: true
        }
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Event not found'
        });
      }

      return event;
    }),

  // สร้างงานใหม่
  create: organizerProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.event.create({
        data: {
          ...input,
          createdBy: ctx.session.user.id
        },
        include: {
          creator: {
            select: { id: true, username: true }
          }
        }
      });
    }),

  // อัพเดทงาน
  update: organizerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
      const event = await ctx.prisma.event.findUnique({
        where: { id },
        select: { createdBy: true }
      });

      if (!event || event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own events'
        });
      }

      return await ctx.prisma.event.update({
        where: { id },
        data,
        include: {
          creator: {
            select: { id: true, username: true }
          }
        }
      });
    }),

  // ลบงาน
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.id },
        select: { createdBy: true }
      });

      if (!event || event.createdBy !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own events'
        });
      }

      return await ctx.prisma.event.delete({
        where: { id: input.id }
      });
    })
});