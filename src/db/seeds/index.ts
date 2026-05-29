import { seedRoles }           from './01-roles';
import { seedPermissions }      from './02-permissions';
import { seedRolePermissions }  from './03-role-permissions';
import { seedUsers }            from './04-users';
import { seedUserRoles }        from './05-user-roles';
import { seedDoctors }          from './06-doctors';
import { seedPatients }         from './07-patients';
import { seedAppointments }     from './08-appointments';
import { seedNotes }            from './09-notes';
import { seedPrescriptions }    from './10-prescriptions';
import { seedNotifications }    from './11-notifications';
import { seedReviews }          from './12-reviews';
import { seedAiLogs }           from './13-ai-logs';
import { seedBlockedSlots }     from './14-blocked-slots';
import { seedChatMessages }     from './15-chat-messages';

// ---------------------------------------------------------------------------
// Orchestrator — runs all seeders in dependency order
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Starting seed...\n');

  const steps: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'roles',            fn: seedRoles           },
    { name: 'permissions',      fn: seedPermissions     },
    { name: 'role-permissions', fn: seedRolePermissions },
    { name: 'users',            fn: seedUsers           },
    { name: 'user-roles',       fn: seedUserRoles       },
    { name: 'doctors',          fn: seedDoctors         },
    { name: 'patients',         fn: seedPatients        },
    { name: 'appointments',     fn: seedAppointments    },
    { name: 'notes',            fn: seedNotes           },
    { name: 'prescriptions',    fn: seedPrescriptions   },
    { name: 'notifications',    fn: seedNotifications   },
    { name: 'reviews',          fn: seedReviews         },
    { name: 'ai-logs',          fn: seedAiLogs          },
    { name: 'blocked-slots',    fn: seedBlockedSlots    },
    { name: 'chat-messages',    fn: seedChatMessages    },
  ];

  for (const step of steps) {
    try {
      await step.fn();
    } catch (err) {
      console.error(`\n✗ Seed failed at step: ${step.name}`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

main();
