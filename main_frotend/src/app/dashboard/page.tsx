"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Plus,
  LogIn,
  Search,
  Crown,
  Users,
  Music,
  Clock,
  ArrowRight,
  LogOut,
  Music2,
  TrendingUp,
} from "lucide-react";

interface Room {
  id: string;
  code: string;
  ownerId: string;
  objectKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
        await fetchRooms(currentUser);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchRooms = async (currentUser: any) => {
    try {
      const token = await currentUser.getIdToken();
      const response = await axios.get("http://localhost:4000/rooms/my-rooms", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRooms(response.data.rooms);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  const createRoom = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await axios.post(
        "http://localhost:4000/rooms/create",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      await fetchRooms(user);
      router.push(`/room/${response.data.roomId}`);
    } catch (error: any) {
      console.error("Failed to create room:", error);
      alert(error.response?.data?.error || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const filteredRooms = rooms.filter((room) =>
    room.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    {
      label: "Total Rooms",
      value: rooms.length.toString(),
      icon: Music2,
      bgColor: "bg-amber-500",
    },
    {
      label: "Active Users",
      value: filteredRooms.length.toString(),
      icon: Users,
      bgColor: "bg-emerald-500",
    },
    {
      label: "Total Tracks",
      value: rooms.filter((r) => r.objectKey).length.toString(),
      icon: TrendingUp,
      bgColor: "bg-fuchsia-500",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 bg-[#0f0f0f] border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative">
                <Crown className="w-5 h-5 sm:w-7 sm:h-7 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">Beatsync</h1>
                <p className="text-xs sm:text-sm text-zinc-600">
                  Your music rooms
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600 flex items-center justify-center text-black font-bold text-sm sm:text-base shadow-lg">
                {user?.displayName?.slice(0, 2).toUpperCase() || "CG"}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 lg:mb-12"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.1, type: "spring" }}
              className="bg-[#1a1a1a] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/5 group hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-bold mb-1 text-zinc-100">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-500">{stat.label}</div>
                </div>
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${stat.bgColor} flex items-center justify-center shadow-lg`}
                >
                  <stat.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Create/Join Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 lg:mb-12"
        >
          {/* Create Room */}
          <motion.button
            onClick={createRoom}
            disabled={loading}
            className="relative group"
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative bg-gradient-to-br from-amber-600/80 via-amber-700/60 to-amber-800/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-amber-500/20 group-hover:border-amber-500/30 transition-all">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-amber-400 flex items-center justify-center shadow-2xl">
                  <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                    {loading ? "Creating..." : "Create Room"}
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-200/70">
                    Start a new music session
                  </p>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Join Room */}
          <motion.div
            className="relative group"
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="relative bg-[#1a1a1a] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/5 group-hover:border-white/10 transition-all">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center transition-colors">
                  <LogIn className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-100 mb-2">
                    Join Room
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter room code..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && joinCode.trim()) {
                          joinRoom(joinCode);
                        }
                      }}
                      className="w-full bg-zinc-900/50 border border-white/5 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Rooms Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-1">
                Your Rooms
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500">
                Manage and join your music sessions
              </p>
            </div>

              <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a1a] rounded-lg pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 border border-white/5 focus:outline-none focus:border-white/10 transition-all"
              />
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#1a1a1a] rounded-2xl p-8 sm:p-12 text-center border border-white/5"
            >
              <Music className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-700 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-zinc-400 mb-2">
                No rooms yet
              </h3>
              <p className="text-zinc-600 text-xs sm:text-sm">
                Create your first room to get started
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {filteredRooms.map((room, index) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 30 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group relative cursor-pointer"
                  onClick={() => joinRoom(room.code)}
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/5 group-hover:border-amber-500/30 transition-all duration-300">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1">
                          <h3 className="text-base sm:text-lg font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                            Room #{room.code}
                          </h3>
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                          </motion.div>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs text-zinc-500 font-mono">
                          <span className="text-zinc-600">#</span>
                          <span>{room.code}</span>
                        </div>
                      </div>

                      {room.objectKey && (
                        <motion.div
                          className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                          animate={{
                            boxShadow: [
                              "0 0 0 rgba(16, 185, 129, 0)",
                              "0 0 10px rgba(16, 185, 129, 0.3)",
                              "0 0 0 rgba(16, 185, 129, 0)",
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-500">
                            Live
                          </span>
                        </motion.div>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-zinc-100">
                            1/8
                          </div>
                          <div className="text-xs text-zinc-600 hidden sm:block">Users</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-zinc-100">
                            {room.objectKey ? "1" : "0"}
                          </div>
                          <div className="text-xs text-zinc-600 hidden sm:block">Tracks</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">
                            {new Date(room.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-white/5">
                      <span className="text-xs text-zinc-600">
                        You own this room
                      </span>
                      <motion.div
                        className="flex items-center space-x-1 text-xs sm:text-sm font-medium text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        whileHover={{ x: 4 }}
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
