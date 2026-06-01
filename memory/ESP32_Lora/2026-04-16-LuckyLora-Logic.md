# Lucky_Lora Logic Plan (2026-04-16)

## Recommended Code Structure: Set A+ (Unified Slave)
I recommend **Set A (One Master, One Unified Slave)**. 
- Why: Maintenance is much easier. If you find a bug in the LoRa communication, you only fix it in one file, not three. 
- Implementation: The Slave code will read the **Dipswitch** at boot. 
  - If Dipswitch = 2: Follow "Badan" (Board 2) schedule logic.
  - If Dipswitch = 3: Follow "Chicken" (Board 3) overlap logic.

## Packet Definition (The "Lucky Packet")
Standard 12-byte payload for RadioLib SX1278.

### Slave -> Master (Heartbeat/Status)
- [0] NodeID (0-6)
- [1] RelayStatus (Bitmask: 00abcdef)
- [2] CurrentMode (0:Idle, 1:P1, 2:P2, 3:Manual)
- [3] Uptime (Minutes)
- [4] LocalHour
- [5] LocalMin

### Master -> Slave (Command/Sync)
- [0] TargetID (0-6 or 255 for Broadcast)
- [1] Command (1:ManualON, 2:Stop, 3:TimeSync)
- [2] Data1 (RelayID or SyncHour)
- [3] Data2 (Duration or SyncMin)

## Sequential Constraint
- Boards 3, 4, 5, 6 must run sequentially (Only one active at a time).
- Boards 0, 1, 2 can run independently/simultaneously.
- UI Design: Boards 3-6 share a single Progress Bar (V50) and a single Value Display (V13).
