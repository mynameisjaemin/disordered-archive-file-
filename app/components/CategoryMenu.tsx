"use client";

import { AnimatePresence, motion } from "framer-motion";
import { categories } from "@/lib/archive/data";
import type { ArchiveSearchResults, CategoryId } from "@/lib/archive/types";

type CategoryMenuProps = {
  selectedCategory: CategoryId | null;
  setSelectedCategory: (id: CategoryId) => void;
  tagQuery: string;
  setTagQuery: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  tagResults: ArchiveSearchResults | null;
  fontClassName: string;
  align?: "center" | "right";
};

function SearchResultItem({
  text,
  onClick,
  align = "center",
}: {
  text: string;
  onClick: () => void;
  align?: "center" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-[11px] tracking-[0.08em] text-neutral-500 underline-offset-4 transition hover:text-black hover:underline ${
        align === "right" ? "text-right" : "text-center"
      }`}
    >
      {text}
    </button>
  );
}

export function CategoryMenu({
  selectedCategory,
  setSelectedCategory,
  tagQuery,
  setTagQuery,
  searchOpen,
  setSearchOpen,
  tagResults,
  fontClassName,
  align = "center",
}: CategoryMenuProps) {
  const countFor = (id: CategoryId) => {
    if (!tagResults) return 0;
    if (id === "references") return tagResults.references.length;
    if (id === "issues") return tagResults.issues.length;
    if (id === "journal") return tagResults.journal.length;
    if (id === "portfolio") return tagResults.portfolio.length;
    if (id === "archive") return tagResults.archive.length;
    if (id === "freeboard") return tagResults.freeboard.length;
    return tagResults.contact.length;
  };

  return (
    <div className={`w-full ${fontClassName}`}>
      <div className={`space-y-4 ${align === "right" ? "text-right" : "text-center"}`}>
        <motion.div
          onHoverStart={() => setSearchOpen(true)}
          onHoverEnd={() => !tagQuery && setSearchOpen(false)}
          layout
          className="space-y-2"
        >
          <div className="text-[12px] tracking-[0.24em] text-neutral-500">SEARCH</div>

          <AnimatePresence>
            {(searchOpen || tagQuery) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-b border-black/10 pb-2">
                  <input
                    value={tagQuery}
                    onChange={(event) => setTagQuery(event.target.value)}
                    placeholder="fashion"
                    className={`w-full bg-transparent text-[12px] tracking-[0.16em] outline-none placeholder:text-neutral-400 ${
                      align === "right" ? "text-right" : "text-center"
                    }`}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.035 }}
            className="space-y-2"
          >
            <button
              onClick={() => setSelectedCategory(category.id)}
              className={`text-[14px] tracking-[0.26em] transition hover:opacity-50 ${
                align === "right" ? "text-right" : "text-center"
              } ${selectedCategory === category.id ? "opacity-100" : ""}`}
            >
              {category.label}
            </button>

            {tagResults && countFor(category.id) > 0 && (
              <div className="space-y-1">
                {category.id === "references" &&
                  tagResults.references.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.title}
                      onClick={() => setSelectedCategory("references")}
                      align={align}
                    />
                  ))}
                {category.id === "issues" &&
                  tagResults.issues.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.title}
                      onClick={() => setSelectedCategory("issues")}
                      align={align}
                    />
                  ))}
                {category.id === "journal" &&
                  tagResults.journal.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.title}
                      onClick={() => setSelectedCategory("journal")}
                      align={align}
                    />
                  ))}
                {category.id === "portfolio" &&
                  tagResults.portfolio.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.title}
                      onClick={() => setSelectedCategory("portfolio")}
                      align={align}
                    />
                  ))}
                {category.id === "archive" &&
                  tagResults.archive.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.title}
                      onClick={() => setSelectedCategory("archive")}
                      align={align}
                    />
                  ))}
                {category.id === "freeboard" &&
                  tagResults.freeboard.map((item) => (
                    <SearchResultItem
                      key={item.id}
                      text={item.content.slice(0, 28)}
                      onClick={() => setSelectedCategory("freeboard")}
                      align={align}
                    />
                  ))}
                {category.id === "contact" &&
                  tagResults.contact.map((item) => (
                    <SearchResultItem
                      key={item}
                      text={item}
                      onClick={() => setSelectedCategory("contact")}
                      align={align}
                    />
                  ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
