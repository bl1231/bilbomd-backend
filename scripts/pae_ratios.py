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
# which Alphafold2 writes to the B-factor column
B_THRESHOLD = 50.00
PAE_POWER = 2.0
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
                    # Continuously update last_resnum
                    last_resnum = int(words[1])
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

    pae_cutoff = 10
    graph_resolution = 1
    # Avoid divide-by-zero by adding a small epsilon value to the denominator
    epsilon = 1e-6  # You can adjust this value based on your specific needs
    weights = 1 / (pae_matrix + epsilon) ** PAE_POWER
    print(f"PAE_POWER: {PAE_POWER}")

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


def separate_into_regions(numbers, chain_segs: list):
    """
    Seprates into regions
    """
    numbers = sorted(numbers)  # Ensure numbers are sorted
    regions = []
    current_region = [numbers[0]]
    for i in range(1, len(numbers)):
        if (numbers[i] == numbers[i - 1] + 1) and (numbers[i - 1] not in chain_segs):
            current_region.append(numbers[i])
        else:
            regions.append(current_region)
            current_region = [numbers[i]]

    regions.append(current_region)
    return regions


def find_and_update_sequential_rigid_domains(lists_of_tuples):
    """
    Find and update sequential Rigid Domains

    This function was a collaboration between ChatGPT and Scott. Each tuple represents
    the start and end of a rigid domain and the chain it belongs to.
    """
    seen_pairs = set()  # To keep track of seen pairs and avoid duplicates
    updates = {}  # To store updates for each tuple
    updated = False  # Flag to indicate if updates were made
    print("-----------------")
    for outer_list in lists_of_tuples:
        for start1, end1, chain1 in outer_list:
            for other_outer_list in lists_of_tuples:
                for start2, end2, chain2 in other_outer_list:
                    if chain1 == chain2:
                        if end1 + 1 == start2:
                            # Ensure the pair is not considered in reverse
                            if (
                                (start1, end1, chain1),
                                (start2, end2, chain2),
                            ) not in seen_pairs:
                                print(
                                    f"Adjacent Rigid Domains: ({start1}, {end1}, '{chain1}') and ({start2}, {end2}, '{chain2}')"
                                )
                                updates[(start1, end1, chain1)] = (start1, end1 - 1)
                                updates[(start2, end2, chain2)] = (start2 + 1, end2)
                                seen_pairs.add(
                                    ((start1, end1, chain1), (start2, end2, chain2))
                                )
                                updated = True

                        elif end2 + 1 == start1:
                            if (
                                (start2, end2, chain2),
                                (start1, end1, chain1),
                            ) not in seen_pairs:
                                print(
                                    f"Adjacent Rigid Domains: ({start2}, {end2}, '{chain2}') and ({start1}, {end1}, '{chain1}')"
                                )
                                updates[(start2, end2, chain2)] = (start2, end2 - 1)
                                updates[(start1, end1, chain1)] = (start1 + 1, end1)
                                seen_pairs.add(
                                    ((start2, end2, chain2), (start1, end1, chain1))
                                )
                                updated = True

    # Apply the updates to the original list
    for i, outer_list in enumerate(lists_of_tuples):
        for j, (start, end, chain) in enumerate(outer_list):
            if (start, end, chain) in updates:
                new_start, new_end = updates[(start, end, chain)]
                lists_of_tuples[i][j] = (new_start, new_end, chain)

    return updated, lists_of_tuples


def define_rigid_domains(
    clusters: list, crd_file: str, first_resnum: int, chain_segment_list: list
) -> list:
    """
    Define all Rigid Domains

    note:
    Rigid Bodies contain one of more Rigid Domains
    Rigid Domains are defined by a tuple of (start_residue, end_residue, segment_id)
    """
    # print(f"chain_segment_list: {chain_segment_list}")
    # print(f"first_resnum: {first_resnum}")
    # print(f"clusters: {clusters}")
    rigid_bodies = []
    for _, cluster in enumerate(clusters):
        rigid_body = []
        if len(cluster) >= MIN_CLUSTER_LENGTH:
            # make sure all elements of cluster are integers.
            # is this needed?
            # res_numbers = [int(num) for num in cluster]
            # print(f"cluster is identical to res_numbers: {cluster == res_numbers}")
            consecutive_regions = separate_into_regions(cluster, chain_segment_list)
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

                    new_rigid_domain = (str1, str2, segid)
                    print(f"new_rigid_domain: {new_rigid_domain} pLDDT: {bfactor_avg}")
                    rigid_body.append(new_rigid_domain)
            rigid_bodies.append(rigid_body)
    # print(f"Rigid Bodies: {rigid_bodies}")
    #
    # remove empty lists from our list of lists of tuples
    all_non_empty_rigid_bodies = [cluster for cluster in rigid_bodies if cluster]
    print(f"Rigid Bodies: {all_non_empty_rigid_bodies}")
    # Now we need to make sure that none of the Rigid Domains (defined as tuples) are
    # adjacent to each other, and if they are we need to adjust the start and end so
    # that we establish a 2 residue gap between them.
    updated = True
    while updated:
        updated, rigid_body_optimized = find_and_update_sequential_rigid_domains(
            all_non_empty_rigid_bodies
        )
    print(f"Optimized Rigid Bodies: {all_non_empty_rigid_bodies}")
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
    parser.add_argument(
        "--pae_power",
        type=float,
        help="PAE power used to weight the cluster_leiden() function",
        default=2.0,
    )

    args = parser.parse_args()

    first_residue, last_residue = get_first_and_last_residue_numbers(args.crd_file)
    # print(f"first_residue: {first_residue} last_residues: {last_residue}")

    # define_segments is used to define breakpoint between PROA-PROB-PROC etc.
    # it is needed in cases where clusting results in a single Leiden cluster
    # that spans multiple chains.
    chain_segments = define_segments(args.crd_file)
    # print(f"here in main - {chain_segments}")
    SELECTED_ROWS_START = first_residue - 1
    SELECTED_ROWS_END = last_residue - 1
    SELECTED_COLS_START = SELECTED_ROWS_START
    SELECTED_COLS_END = SELECTED_ROWS_END

    # set global constant for pae_power
    PAE_POWER = args.pae_power

    correct_json_brackets(args.pae_file, TEMP_FILE_JSON)

    # print(
    #     f"row_start: {SELECTED_ROWS_START}\n"
    #     f"row_end:{SELECTED_ROWS_END}\n"
    #     f"col_start:{SELECTED_COLS_START}\n"
    #     f"col_end:{SELECTED_COLS_END}\n"
    # )
    pae_clusters = define_clusters_for_selected_pae(
        TEMP_FILE_JSON,
        SELECTED_ROWS_START,
        SELECTED_ROWS_END,
        SELECTED_COLS_START,
        SELECTED_COLS_END,
    )
    # print(f"pae_clusters: {pae_clusters}")

    rigid_body_clusters = define_rigid_domains(
        pae_clusters, args.crd_file, first_residue, chain_segments
    )

    write_const_file(rigid_body_clusters, CONST_FILE_PATH)
    print("------------- done -------------")
