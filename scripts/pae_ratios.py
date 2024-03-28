"""
Provides functions to create const.inp file from PAE and CRD files
"""

import argparse
import json
from collections import defaultdict
from typing import Tuple, Optional
import igraph
import numpy

# This is defining the pLDDT threshold for determing flex/rigid
# which Alphafold2 writes to teh B-factor column
B_THRESHOLD = 50.00
MIN_CLUSTER_LENGTH = 5
CONST_FILE_PATH = "const.inp"
CLUSTER_FILE = "clusters.csv"
TEMP_FILE_JSON = "temp.json"


def get_first_and_last_residue_numbers(
    crd_file: str,
) -> Tuple[Optional[int], Optional[int]]:
    """
    Returns the first and last residue numbers from a CRD file. Ignores initial comment
    lines starting with '*', starts processing lines after a line ending in 'EXT'.

    :param crd_file: Path to the CRD file.
    :return: A tuple containing the first and last residue numbers. Returns None for
            each if not found.
    """
    first_resnum = None
    last_resnum = None
    start_processing = False  # Flag to indicate when to start processing lines

    with open(file=crd_file, mode="r", encoding="utf8") as infile:
        for line in infile:
            # Skip all lines until we find the line ending with 'EXT'
            # I hope this is univeral to all CRD files.
            if not start_processing:
                if line.strip().endswith("EXT"):
                    start_processing = True
                continue  # Skip current iteration and proceed to the next line

            words = line.split()
            # Start processing lines to find first and last residue numbers
            if start_processing and words:
                if first_resnum is None:
                    try:
                        first_resnum = int(
                            words[1]
                        )  # Assuming col 1 has the residue numbers
                    except ValueError:
                        continue  # Skip lines that do not start with an integer
                try:
                    last_resnum = int(words[1])  # Continuously update last_resnum
                except ValueError:
                    pass  # Ignore lines that do not start with an integer

    return first_resnum, last_resnum

def define_segments(crd_file: str):
    """
    Defines segments. But what is it actually doing?
    """
    differing_pairs = []
    with open(file=crd_file, mode="r", encoding="utf8") as infile:
        current_line = infile.readline().split()
        line_number = 1
        for line in infile:
            line_number += 1
            next_line = line.split()

            if (
                len(current_line) == 10
                and len(next_line) == 10
                and current_line[7] != next_line[7]
            ):
                differing_pairs.append(int(current_line[1]) - 1)
            current_line = next_line  # Move to the next line
    return differing_pairs


def correct_json_brackets(pae, output_file_path):
    """
    Removes the leading '[' and trailing ']' from a JSON-like string in the
    file, if present, and writes the result to an output file.
    """
    with open(file=pae, mode="r", encoding="utf8") as infile, open(
        file=output_file_path, mode="w", encoding="utf8"
    ) as output_file_handle:
        # Read the content of the file as a string
        json_content = infile.read()
        # Check if the string starts with '[' and ends with ']'
        if json_content.startswith("[") and json_content.endswith("]"):
            # Remove the first and last characters
            corrected_content = json_content[1:-1]
            output_file_handle.write(corrected_content)
        else:
            # Write the original content if it doesn't start
            # with '[' and end with ']'
            output_file_handle.write(json_content)


def define_clusters_for_selected_pae(
    pae_file: str, row_start: int, row_end: int, col_start: int, col_end: int
):
    """
    Define PAE clusters
    """
    with open(file=pae_file, mode="r", encoding="utf8") as json_file:
        data = json.load(json_file)

    if "pae" in data:
        matrix = data["pae"]
    elif "predicted_aligned_error" in data:
        matrix = data["predicted_aligned_error"]
    else:
        raise ValueError("Invalid PAE JSON format.")

    selected_matrix = []

    for i, row in enumerate(matrix):
        if row_start <= i <= row_end:
            new_row = [
                value if col_start <= j <= col_end else 30.0
                for j, value in enumerate(row)
            ]
            selected_matrix.append(new_row)

    selected_data = {"predicted_aligned_error": selected_matrix}

    if "predicted_aligned_error" not in selected_data:
        raise ValueError("Invalid PAE JSON format.")

    pae_matrix = numpy.array(
        selected_data["predicted_aligned_error"], dtype=numpy.float64
    )

    pae_power = 1.4
    pae_cutoff = 10
    graph_resolution = 1
    # Avoid divide-by-zero by adding a small epsilon value to the denominator
    epsilon = 1e-6  # You can adjust this value based on your specific needs
    weights = 1 / (pae_matrix + epsilon) ** pae_power

    g = igraph.Graph()
    size = weights.shape[0]
    g.add_vertices(range(size))
    edges = numpy.argwhere(pae_matrix < pae_cutoff)
    sel_weights = weights[edges.T[0], edges.T[1]]
    g.add_edges(edges)
    g.es["weight"] = sel_weights

    vc = g.community_leiden(
        weights="weight", resolution=graph_resolution / 100, n_iterations=10
    )
    membership = numpy.array(vc.membership)

    membership_clusters = defaultdict(list)
    for index, cluster in enumerate(membership):
        membership_clusters[cluster].append(index)

    # Directly sort the cluster values by their length in descending order
    sorted_clusters = sorted(membership_clusters.values(), key=len, reverse=True)
    return sorted_clusters


def is_float(arg):
    """
    Returns Boolean if arg is a float
    """
    try:
        float(arg)
        return True
    except ValueError:
        return False


def separate_into_regions(numbers, chain_segments: list):
    """
    Seprates into regions
    """
    numbers = sorted(numbers)  # Ensure numbers are sorted
    regions = []
    current_region = [numbers[0]]
    for i in range(1, len(numbers)):
        if (numbers[i] == numbers[i - 1] + 1) and (numbers[i-1] not in chain_segments):
            current_region.append(numbers[i])
        else:
            regions.append(current_region)
            current_region = [numbers[i]]

    regions.append(current_region)
    return regions


def define_rigid_clusters(cluster_list: list, crd_file: str, first_resnum: int, chain_segment_list: list) -> list:
    """
    Define a rigid cluster
    """
    # print(chain_segment_list)
    rb = []
    for idx, cluster in enumerate(cluster_list):
        pairs = []
        if len(cluster) >= MIN_CLUSTER_LENGTH:
            print(f"cluster{idx} len: {len(cluster)}: {cluster}")
            numbers = [int(num) for num in cluster]
            # print(f"{len(cluster)} - {numbers}")
            consecutive_regions = separate_into_regions(numbers, chain_segment_list)
            # consecutive_regions = separate_into_regions(numbers)
            for region in consecutive_regions:
                first_resnum_cluster = region[0]
                last_resnum_cluster = region[-1]
                # check which rigid domains are rigid and
                # which are flexbible based on avearge Bfactor
                bfactors = []
                with open(file=crd_file, mode="r", encoding="utf8") as infile:
                    for line in infile:
                        words = line.split()
                        if (
                            len(words) >= 10
                            and is_float(words[9])
                            and not words[0].startswith("*")
                        ):
                            if float(words[9]) > 0.0:
                                bfactor = words[9]
                                resnum = words[1]

                                if (
                                    bfactor.replace(".", "", 1).isdigit()
                                    and (
                                        int(resnum)
                                        >= first_resnum_cluster + first_resnum
                                    )
                                    and (
                                        int(resnum)
                                        <= last_resnum_cluster + first_resnum
                                    )
                                ):
                                    bfactors.append(float(bfactor))
                # print(f"bfactor list is {len(bfactors)}")
                bfactor_avg = sum(bfactors) / len(bfactors)

                if bfactor_avg > B_THRESHOLD:
                    with open(file=crd_file, mode="r", encoding="utf8") as infile:
                        for line in infile:
                            words = line.split()
                            if (
                                len(words) >= 10
                                and is_float(words[9])
                                and not words[0].startswith("*")
                            ):
                                if int(words[1]) == first_resnum_cluster + first_resnum:
                                    str1 = int(words[8])
                                elif (
                                    int(words[1]) == last_resnum_cluster + first_resnum
                                ):
                                    str2 = int(words[8])
                                    segid = words[7]

                    new_pair = (str1, str2, segid)
                    print(f"new_pair: {new_pair} pLDDT: {bfactor_avg}")
                    pairs.append(new_pair)
            rb.append(pairs)
    print(f"1-RBs: {rb}")

    # Optimizing Rigid Bodies with a minimum gap
    rigid_body_optimized = []
    for i_clus, cluster in enumerate(rb):
        if not cluster:  # Skip empty clusters
            continue
        cluster_optimized = []
        for i, pair in enumerate(cluster):
            # Copy the pair to avoid mutating the original while iterating
            pair = list(pair)
            print(f"{i_clus} pair: {pair}")
            if i < len(cluster) - 1:  # If not the last pair in the cluster
                next_pair = cluster[i + 1]
                if pair[2] == next_pair[2]:  # If in the same segment
                    gap = next_pair[0] - pair[1] - 1
                    print(f"i: {i} gap: {gap} pair: {pair}")
                    if gap < 2:  # If the gap is less than 3 residues
                        # Adjust the end residue of the current pair to enforce the gap
                        pair[1] = next_pair[0] - 3
            cluster_optimized.append(tuple(pair))
        rigid_body_optimized.append(cluster_optimized)

    # Removing empty lists is already handled by the check for empty clusters
    rigid_body_optimized = [cluster for cluster in rigid_body_optimized if cluster]

    print(f"2-RBs: {rigid_body_optimized}")
    return rigid_body_optimized


def write_const_file(rigid_body_list: list, output_file):
    """
    Write const.inp file
    """
    dock_count = 0
    rigid_body_count = 0
    # print(f"rigid body list: {rigid_body_list}")
    with open(file=output_file, mode="w", encoding="utf8") as const_file:
        for rigid_body in rigid_body_list:
            # print(f"rigid_body: {rigid_body}")
            rigid_body_count += 1
            p = 0
            n = 0
            for rigid_domain in rigid_body:
                start_residue = rigid_domain[0]
                end_residue = rigid_domain[1]
                segment = rigid_domain[2]
                if rigid_body_count == 1:
                    p += 1
                    const_file.write(
                        f"define fixed{p} sele ( resid {start_residue}:{end_residue}"
                        f" .and. segid {segment} ) end\n"
                    )
                    if p == len(rigid_body):
                        const_file.write("cons fix sele ")
                        for number in range(1, p):
                            const_file.write(f"fixed{number} .or. ")
                        const_file.write(f"fixed{p} end \n")
                        const_file.write("\n")
                elif rigid_body_count > 1:
                    n += 1
                    const_file.write(
                        f"define rigid{n} sele ( resid {start_residue}:{end_residue}"
                        f" .and. segid {segment} ) end\n"
                    )
                    if n == len(rigid_body):
                        dock_count += 1
                        const_file.write(f"shape desc dock{dock_count} rigid sele ")
                        for number in range(1, n):
                            const_file.write(f"rigid{number} .or. ")
                        const_file.write(f"rigid{n} end \n")
                        const_file.write("\n")
        const_file.write("return \n")
        const_file.write("\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract PAE matrix for interacxtive region from an AlphaFold PAE matrix."
    )
    parser.add_argument("pae_file", type=str, help="Name of the PAE JSON file.")
    parser.add_argument("crd_file", type=str, help="Name of the CRD file.")
    args = parser.parse_args()

    first_residue, last_residue = get_first_and_last_residue_numbers(args.crd_file)
    # print(f"first_residue: {first_residue} last_residues: {last_residue}")

    # this doesn't appear to be actually doing anything...
    chain_segments = define_segments(args.crd_file)
    print(f"here in main - {chain_segments}")
    SELECTED_ROWS_START = first_residue - 1
    SELECTED_ROWS_END = last_residue - 1
    SELECTED_COLS_START = SELECTED_ROWS_START
    SELECTED_COLS_END = SELECTED_ROWS_END

    correct_json_brackets(args.pae_file, TEMP_FILE_JSON)

    print(
        f"row_start: {SELECTED_ROWS_START}\n"
        f"row_end:{SELECTED_ROWS_END}\n"
        f"col_start:{SELECTED_COLS_START}\n"
        f"col_end:{SELECTED_COLS_END}\n"
    )
    pae_clusters = define_clusters_for_selected_pae(
        TEMP_FILE_JSON,
        SELECTED_ROWS_START,
        SELECTED_ROWS_END,
        SELECTED_COLS_START,
        SELECTED_COLS_END,
    )
    # print(f"pae_clusters: {pae_clusters}")

    rigid_body_clusters = define_rigid_clusters(
        pae_clusters, args.crd_file, first_residue, chain_segments
    )

    write_const_file(rigid_body_clusters, CONST_FILE_PATH)
    print("done")

    # max_len = max(len(c) for c in pae_clusters)
    # pae_clusters = [
    #     list(c) + [""] * (max_len - len(c)) for c in pae_clusters if len(c) > 2
    # ]

    # with open(file=CLUSTER_FILE, mode="wt", encoding="utf8") as outfile:
    #     for c in pae_clusters:
    #         outfile.write(",".join([str(e) for e in c]) + "\n")

    # print(
    #     f"Wrote {len(pae_clusters)} clusters to {CLUSTER_FILE}. "
    #     f"The largest cluster contains {max_len} residues."
    # )
